import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createOpenAI } from "../src/providers/openai";
import { ProviderError } from "../src/types";

const body = JSON.parse(readFileSync(join(import.meta.dir, "fixtures", "openai-response.json"), "utf8"));

type Seen = { url: string; init: RequestInit };

function fakeFetch(respond: (seen: Seen) => Response | Promise<Response>) {
	const calls: Seen[] = [];
	const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
		const seen = { url: String(input), init: init ?? {} };
		calls.push(seen);
		return respond(seen);
	}) as typeof fetch;
	return { fetcher, calls };
}

const ok = (value: unknown) =>
	new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
const fail = (status: number, error: unknown) => new Response(JSON.stringify({ error }), { status });

async function errorOf(run: Promise<unknown>) {
	try {
		await run;
	} catch (error) {
		if (error instanceof ProviderError) return error;
		throw error;
	}
	throw new Error("expected a ProviderError");
}

test("sends a web search request to the Responses API", async () => {
	const { fetcher, calls } = fakeFetch(() => ok(body));
	await createOpenAI({ apiKey: "sk-test", model: "m1", fetch: fetcher }).ask("best crm?");
	expect(calls.length).toBe(1);
	expect(calls[0]?.url).toBe("https://api.openai.com/v1/responses");
	expect(calls[0]?.init.method).toBe("POST");
	const headers = new Headers(calls[0]?.init.headers);
	expect(headers.get("authorization")).toBe("Bearer sk-test");
	expect(headers.get("content-type")).toBe("application/json");
	expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
		model: "m1",
		input: "best crm?",
		tools: [{ type: "web_search" }],
		include: ["web_search_call.action.sources"],
	});
});

test("uses a custom base url without doubling slashes", async () => {
	const { fetcher, calls } = fakeFetch(() => ok(body));
	await createOpenAI({ apiKey: "k", model: "m", fetch: fetcher, baseUrl: "https://gateway.example/v1/" }).ask("q");
	expect(calls[0]?.url).toBe("https://gateway.example/v1/responses");
});

test("parses text, citations, sources and usage", async () => {
	const { fetcher } = fakeFetch(() => ok(body));
	const answer = await createOpenAI({ apiKey: "k", model: "m1", fetch: fetcher }).ask("q");
	expect(answer.engine).toBe("openai");
	expect(answer.model).toBe("example-model");
	expect(answer.text).toBe("HubSpot is the usual default, while Pipedrive is cheaper for sales-led agencies.");
	expect(answer.searched).toBe(true);
	expect(answer.citations).toEqual([
		{ url: "https://www.hubspot.com/pricing/sales", domain: "hubspot.com", title: "HubSpot Sales Hub pricing" },
		{ url: "https://www.pipedrive.com/en/pricing", domain: "pipedrive.com", title: "Pipedrive pricing" },
	]);
	expect(answer.sources.map((s) => s.domain)).toEqual(["hubspot.com", "pipedrive.com", "attio.com"]);
	expect(answer.usage).toEqual({ inputTokens: 4200, outputTokens: 310, searches: 1 });
	expect(answer.durationMs).toBeGreaterThanOrEqual(0);
});

test("a cited url missing from sources is still a source", async () => {
	const copy = structuredClone(body);
	copy.output[0].action.sources = [];
	const answer = await createOpenAI({ apiKey: "k", model: "m", fetch: fakeFetch(() => ok(copy)).fetcher }).ask("q");
	expect(answer.sources.map((s) => s.domain)).toEqual(["hubspot.com", "pipedrive.com"]);
});

test("urls written in the text without annotations are citations", async () => {
	const copy = structuredClone(body);
	copy.output[1].content[0].annotations = [];
	copy.output[1].content[0].text = "See https://attio.com/f/best-crm-for-agencies for details.";
	const answer = await createOpenAI({ apiKey: "k", model: "m", fetch: fakeFetch(() => ok(copy)).fetcher }).ask("q");
	expect(answer.citations.map((c) => c.url)).toEqual(["https://attio.com/f/best-crm-for-agencies"]);
});

test("an answer without a search call is not searched", async () => {
	const copy = structuredClone(body);
	copy.output = [{ type: "message", content: [{ type: "output_text", text: "Paris." }] }];
	delete copy.usage;
	const answer = await createOpenAI({ apiKey: "k", model: "m", fetch: fakeFetch(() => ok(copy)).fetcher }).ask("q");
	expect(answer.searched).toBe(false);
	expect(answer.sources).toEqual([]);
	expect(answer.citations).toEqual([]);
	expect(answer.usage).toBeNull();
});

test("http errors are classified", async () => {
	const ask = (response: Response) =>
		errorOf(createOpenAI({ apiKey: "k", model: "m9", fetch: fakeFetch(() => response).fetcher }).ask("q"));
	expect((await ask(fail(401, { message: "Incorrect API key provided", code: "invalid_api_key" }))).code).toBe(
		"not_logged_in",
	);
	expect((await ask(fail(429, { message: "Rate limit reached" }))).code).toBe("rate_limited");
	const missing = await ask(fail(404, { message: "The model `m9` does not exist", code: "model_not_found" }));
	expect(missing.code).toBe("model_unavailable");
	expect(missing.message).toContain("m9");
	const other = await ask(fail(500, { message: "The server had an error" }));
	expect(other.code).toBe("failed");
	expect(other.message).toContain("The server had an error");
});

test("a non-JSON error body still gives a readable failure", async () => {
	const error = await errorOf(
		createOpenAI({
			apiKey: "k",
			model: "m",
			fetch: fakeFetch(() => new Response("<html>Bad gateway</html>", { status: 502 })).fetcher,
		}).ask("q"),
	);
	expect(error.code).toBe("failed");
	expect(error.message).toContain("502");
});

test("a 200 response with an empty or malformed body fails", async () => {
	const ask = (response: Response) =>
		errorOf(createOpenAI({ apiKey: "k", model: "m", fetch: fakeFetch(() => response).fetcher }).ask("q"));
	expect((await ask(new Response("not json", { status: 200 }))).code).toBe("failed");
	expect((await ask(ok({ output: [] }))).code).toBe("failed");
	expect((await ask(ok({ nothing: true }))).code).toBe("failed");
});

test("a network failure is reported as failed", async () => {
	const error = await errorOf(
		createOpenAI({
			apiKey: "k",
			model: "m",
			fetch: fakeFetch(() => Promise.reject(new TypeError("fetch failed"))).fetcher,
		}).ask("q"),
	);
	expect(error.code).toBe("failed");
	expect(error.message).toContain("fetch failed");
});

test("an aborted request is reported as timeout", async () => {
	const { fetcher } = fakeFetch(
		({ init }) =>
			new Promise<Response>((_, reject) => {
				init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
			}),
	);
	const provider = createOpenAI({ apiKey: "k", model: "m", fetch: fetcher });
	const controller = new AbortController();
	setTimeout(() => controller.abort(), 20);
	expect((await errorOf(provider.ask("q", { signal: controller.signal }))).code).toBe("timeout");
	expect((await errorOf(provider.ask("q", { timeoutMs: 20 }))).code).toBe("timeout");
});

test("the api key never appears in an error message", async () => {
	const error = await errorOf(
		createOpenAI({
			apiKey: "sk-secret-123",
			model: "m",
			fetch: fakeFetch(() => fail(401, { message: "Incorrect API key provided: sk-secret-123" })).fetcher,
		}).ask("q"),
	);
	expect(error.message).not.toContain("sk-secret-123");
});
