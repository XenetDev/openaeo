import { expect, test } from "bun:test";
import { createAnthropic } from "../src/providers/anthropic";
import { createGemini } from "../src/providers/gemini";
import { createPerplexity } from "../src/providers/perplexity";
import { createXai } from "../src/providers/xai";
import { ProviderError } from "../src/types";

type Seen = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function fake(status: number, payload: unknown) {
	const calls: Seen[] = [];
	const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
		calls.push({
			url: String(input),
			headers: init?.headers as Record<string, string>,
			body: JSON.parse(String(init?.body)),
		});
		return new Response(JSON.stringify(payload), { status });
	}) as typeof fetch;
	return { fetcher, calls };
}

async function codeOf(run: Promise<unknown>) {
	try {
		await run;
	} catch (error) {
		if (error instanceof ProviderError) return error.code;
		throw error;
	}
	return "no error";
}

test("xAI: asks the Responses API with web search and reads text, citations and usage", async () => {
	const f = fake(200, {
		model: "grok-4.7",
		output: [
			{ type: "web_search_call", action: { sources: [{ type: "url", url: "https://g2.com/crm" }] } },
			{
				type: "message",
				content: [
					{
						type: "output_text",
						text: "Pipedrive is a solid pick.",
						annotations: [{ type: "url_citation", url: "https://pipedrive.com/pricing", title: "1" }],
					},
				],
			},
		],
		usage: { input_tokens: 120, output_tokens: 40, server_side_tool_usage_details: { web_search_calls: 2 } },
	});
	const answer = await createXai({ apiKey: "xai-secret", fetch: f.fetcher }).ask("best crm?");
	expect(f.calls[0]?.url).toBe("https://api.x.ai/v1/responses");
	expect(f.calls[0]?.headers.authorization).toBe("Bearer xai-secret");
	expect(f.calls[0]?.body).toMatchObject({
		model: "grok-4.7",
		tools: [{ type: "web_search" }],
		max_turns: 1,
		stream: false,
		store: false,
	});
	expect(answer).toMatchObject({
		engine: "xai",
		text: "Pipedrive is a solid pick.",
		searched: true,
		usage: { inputTokens: 120, outputTokens: 40, searches: 2 },
	});
	expect(answer.citations.map((c) => c.domain)).toEqual(["pipedrive.com"]);
	expect(answer.sources.map((c) => c.domain)).toEqual(["g2.com", "pipedrive.com"]);
});

test("xAI: a bad key comes back as HTTP 400 and is still reported as a key problem, without leaking the key", async () => {
	const f = fake(400, { code: "invalid-argument", error: "Incorrect API key provided: xai-secret." });
	const run = createXai({ apiKey: "xai-secret", fetch: f.fetcher }).ask("q");
	expect(await codeOf(run)).toBe("not_logged_in");
	expect(
		await codeOf(createXai({ apiKey: "k", fetch: fake(429, { code: "x", error: "slow down" }).fetcher }).ask("q")),
	).toBe("rate_limited");
});

test("Perplexity: inline markers become the cited pages and the search results become sources", async () => {
	const f = fake(200, {
		model: "perplexity/sonar",
		output: [
			{
				type: "search_results",
				queries: ["best crm"],
				results: [
					{ id: 1, url: "https://g2.com/crm", title: "G2 CRM grid" },
					{ id: 2, url: "https://hubspot.com/crm", title: "HubSpot" },
				],
			},
			{
				type: "message",
				content: [{ type: "output_text", text: "Pipedrive leads [1] and HubSpot follows [web:2]. Unknown [9]." }],
			},
		],
		usage: { input_tokens: 10, output_tokens: 20, tool_calls_details: { search_web: { invocation: 1 } } },
	});
	const answer = await createPerplexity({ apiKey: "pplx", fetch: f.fetcher }).ask("best crm?");
	expect(f.calls[0]?.url).toBe("https://api.perplexity.ai/v1/agent");
	expect(f.calls[0]?.body).toMatchObject({
		model: "perplexity/sonar",
		input: "best crm?",
		tools: [{ type: "web_search" }],
		stream: false,
	});
	expect(answer.text).toBe(
		"Pipedrive leads https://g2.com/crm and HubSpot follows https://hubspot.com/crm. Unknown [9].",
	);
	expect(answer.citations.map((c) => c.domain)).toEqual(["g2.com", "hubspot.com"]);
	expect(answer.usage).toEqual({ inputTokens: 10, outputTokens: 20, searches: 1 });
});

test("Perplexity: key, credit and rate problems are told apart", async () => {
	const p = (status: number) =>
		createPerplexity({
			apiKey: "k",
			fetch: fake(status, { error: { message: "nope", type: "x", code: status } }).fetcher,
		}).ask("q");
	expect(await codeOf(p(401))).toBe("not_logged_in");
	expect(await codeOf(p(402))).toBe("rate_limited");
	expect(await codeOf(p(429))).toBe("rate_limited");
});

test("Anthropic: text fragments are joined and citations and search results are collected", async () => {
	const f = fake(200, {
		model: "claude-sonnet-5-5",
		stop_reason: "end_turn",
		content: [
			{ type: "text", text: "I'll look that up. " },
			{ type: "server_tool_use", name: "web_search", input: { query: "best crm" } },
			{
				type: "web_search_tool_result",
				content: [{ type: "web_search_result", url: "https://g2.com/crm", title: "G2" }],
			},
			{
				type: "text",
				text: "Pipedrive is strong",
				citations: [{ type: "web_search_result_location", url: "https://pipedrive.com/", title: "Pipedrive" }],
			},
			{ type: "text", text: " for small teams." },
		],
		usage: { input_tokens: 300, output_tokens: 90, server_tool_use: { web_search_requests: 1 } },
	});
	const answer = await createAnthropic({ apiKey: "sk-ant", fetch: f.fetcher }).ask("best crm?");
	expect(f.calls[0]?.url).toBe("https://api.anthropic.com/v1/messages");
	expect(f.calls[0]?.headers["x-api-key"]).toBe("sk-ant");
	expect(f.calls[0]?.body).toMatchObject({
		model: "claude-sonnet-5-5",
		tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
	});
	expect(answer.text).toBe("I'll look that up. Pipedrive is strong for small teams.");
	expect(answer.citations.map((c) => c.domain)).toEqual(["pipedrive.com"]);
	expect(answer.sources.map((c) => c.domain)).toEqual(["g2.com", "pipedrive.com"]);
	expect(answer.usage).toEqual({ inputTokens: 300, outputTokens: 90, searches: 1 });
});

test("Anthropic: a search error block inside a 200 response does not crash, and HTTP errors are classified", async () => {
	const f = fake(200, {
		stop_reason: "end_turn",
		content: [
			{ type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } },
			{ type: "text", text: "From memory: Pipedrive." },
		],
	});
	expect((await createAnthropic({ apiKey: "k", fetch: f.fetcher }).ask("q")).text).toBe("From memory: Pipedrive.");
	const a = (status: number) =>
		createAnthropic({
			apiKey: "k",
			fetch: fake(status, { type: "error", error: { type: "x", message: "nope" } }).fetcher,
		}).ask("q");
	expect(await codeOf(a(401))).toBe("not_logged_in");
	expect(await codeOf(a(529))).toBe("rate_limited");
	expect(await codeOf(a(404))).toBe("model_unavailable");
});

test("Gemini: grounding links that hide the site behind a Google redirect are turned back into the site", async () => {
	const f = fake(200, {
		modelVersion: "gemini-3.8-flash",
		candidates: [
			{
				content: { parts: [{ text: "thinking", thought: true }, { text: "Pipedrive is " }, { text: "a good fit." }] },
				groundingMetadata: {
					webSearchQueries: ["best crm"],
					groundingChunks: [
						{
							web: {
								uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc",
								title: "pipedrive.com",
							},
						},
						{ web: { uri: "https://g2.com/crm", title: "G2 grid" } },
					],
				},
			},
		],
		usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 12, thoughtsTokenCount: 5 },
	});
	const answer = await createGemini({ apiKey: "g-key", fetch: f.fetcher }).ask("best crm?");
	expect(f.calls[0]?.url).toBe(
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
	);
	expect(f.calls[0]?.headers["x-goog-api-key"]).toBe("g-key");
	expect(f.calls[0]?.body).toMatchObject({ tools: [{ google_search: {} }] });
	expect(answer.text).toBe("Pipedrive is a good fit.");
	expect(answer.citations.map((c) => c.domain)).toEqual(["pipedrive.com", "g2.com"]);
	expect(answer.usage).toEqual({ inputTokens: 8, outputTokens: 17, searches: 1 });
});

test("Gemini: an invalid key arrives as HTTP 400 and is reported as a key problem", async () => {
	const bad = fake(400, {
		error: {
			code: 400,
			message: "API key not valid.",
			status: "INVALID_ARGUMENT",
			details: [{ reason: "API_KEY_INVALID" }],
		},
	});
	expect(await codeOf(createGemini({ apiKey: "k", fetch: bad.fetcher }).ask("q"))).toBe("not_logged_in");
	expect(
		await codeOf(createGemini({ apiKey: "k", fetch: fake(429, { error: { message: "quota" } }).fetcher }).ask("q")),
	).toBe("rate_limited");
});

test("every adapter treats an empty answer as a failure", async () => {
	expect(await codeOf(createXai({ apiKey: "k", fetch: fake(200, { output: [] }).fetcher }).ask("q"))).toBe("failed");
	expect(await codeOf(createPerplexity({ apiKey: "k", fetch: fake(200, { output: [] }).fetcher }).ask("q"))).toBe(
		"failed",
	);
	expect(await codeOf(createAnthropic({ apiKey: "k", fetch: fake(200, { content: [] }).fetcher }).ask("q"))).toBe(
		"failed",
	);
	expect(await codeOf(createGemini({ apiKey: "k", fetch: fake(200, { candidates: [] }).fetcher }).ask("q"))).toBe(
		"failed",
	);
});
