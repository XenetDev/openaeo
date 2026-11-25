import { z } from "zod";
import { type Answer, type AskOptions, type Provider, ProviderError, type ProviderErrorCode } from "../types";
import { extractUrls } from "../url";
import { collectSources } from "./jsonl";

export const OPENAI_DEFAULT_MODEL = "gpt-6.1-terra";

export type OpenAIOptions = { apiKey: string; model: string; fetch?: typeof fetch; baseUrl?: string };

const DEFAULT_TIMEOUT_MS = 180_000;

const SearchCallSchema = z.object({
	type: z.literal("web_search_call"),
	action: z.object({ type: z.string().optional(), sources: z.array(z.unknown()).optional() }).optional(),
});

const MessageSchema = z.object({
	type: z.literal("message"),
	content: z.array(z.unknown()),
});

const TextSchema = z.object({
	type: z.literal("output_text"),
	text: z.string(),
	annotations: z.array(z.unknown()).optional(),
});

const CitationSchema = z.object({ type: z.literal("url_citation"), url: z.string(), title: z.string().optional() });
const SourceSchema = z.object({ url: z.string(), title: z.string().optional() });

const RefusalSchema = z.object({ type: z.literal("refusal"), refusal: z.string() });

const ResponseSchema = z.object({
	model: z.string().optional(),
	status: z.string().optional(),
	error: z.object({ message: z.string().optional() }).nullish(),
	incomplete_details: z.object({ reason: z.string().optional() }).nullish(),
	output: z.array(z.unknown()),
	usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() }).optional(),
});

const ErrorSchema = z.object({ error: z.object({ message: z.string().optional(), code: z.string().nullish() }) });

function fail(code: ProviderErrorCode, message: string): never {
	throw new ProviderError("openai", code, message);
}

export function createOpenAI(o: OpenAIOptions): Provider {
	const fetcher = o.fetch ?? fetch;
	const endpoint = `${(o.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "")}/responses`;
	const redact = (text: string) => (o.apiKey ? text.split(o.apiKey).join("[key]") : text);

	return {
		id: "openai",
		async ask(prompt: string, opts: AskOptions = {}): Promise<Answer> {
			const started = Date.now();
			const timeout = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
			const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

			let response: Response;
			let raw: string;
			try {
				response = await fetcher(endpoint, {
					method: "POST",
					headers: { authorization: `Bearer ${o.apiKey}`, "content-type": "application/json" },
					body: JSON.stringify({
						model: o.model,
						input: prompt,
						tools: [{ type: "web_search", search_context_size: "low" }],
						max_tool_calls: 2,
						include: ["web_search_call.action.sources"],
					}),
					signal,
				});
				raw = await response.text();
			} catch (error) {
				if (opts.signal?.aborted) fail("timeout", "The OpenAI request was cancelled.");
				if (signal.aborted) fail("timeout", "OpenAI did not answer in time.");
				fail("failed", `Could not reach OpenAI: ${redact(error instanceof Error ? error.message : String(error))}`);
			}

			let json: unknown = null;
			try {
				json = JSON.parse(raw);
			} catch {}

			if (!response.ok) {
				const parsed = ErrorSchema.safeParse(json);
				const detail = redact(parsed.success ? (parsed.data.error.message ?? "") : "");
				const code = parsed.success ? parsed.data.error.code : null;
				if (response.status === 401) fail("not_logged_in", "OpenAI rejected the API key. Check the key and try again.");
				if (response.status === 429) fail("rate_limited", `OpenAI rate limit or quota reached. ${detail}`.trim());
				if (code === "model_not_found")
					fail("model_unavailable", `OpenAI model \`${o.model}\` is not available to this key. ${detail}`.trim());
				fail("failed", `OpenAI returned HTTP ${response.status}. ${detail}`.trim());
			}

			const parsed = ResponseSchema.safeParse(json);
			if (!parsed.success) fail("failed", "OpenAI returned a response in an unexpected format.");

			if (parsed.data.status === "failed") {
				fail("failed", `OpenAI could not complete the request. ${redact(parsed.data.error?.message ?? "")}`.trim());
			}
			if (parsed.data.status === "incomplete") {
				fail(
					"failed",
					`OpenAI stopped before finishing the answer (${parsed.data.incomplete_details?.reason ?? "no reason given"}).`,
				);
			}

			const texts: string[] = [];
			const refusals: string[] = [];
			const cited: { url: string; title?: string }[] = [];
			const consulted: { url: string; title?: string }[] = [];
			let searched = false;
			let searches = 0;

			for (const item of parsed.data.output) {
				const call = SearchCallSchema.safeParse(item);
				if (call.success) {
					searched = true;
					if ((call.data.action?.type ?? "search") === "search") searches += 1;
					for (const entry of call.data.action?.sources ?? []) {
						const source = SourceSchema.safeParse(entry);
						if (source.success) consulted.push(source.data);
					}
					continue;
				}
				const message = MessageSchema.safeParse(item);
				if (!message.success) continue;
				for (const block of message.data.content) {
					const refusal = RefusalSchema.safeParse(block);
					if (refusal.success) refusals.push(refusal.data.refusal);
					const text = TextSchema.safeParse(block);
					if (!text.success) continue;
					texts.push(text.data.text);
					for (const annotation of text.data.annotations ?? []) {
						const citation = CitationSchema.safeParse(annotation);
						if (citation.success) cited.push({ url: citation.data.url, title: citation.data.title });
					}
				}
			}

			const text = texts.join("\n\n");
			if (!text.trim()) {
				if (refusals.length) fail("failed", `OpenAI declined to answer: ${refusals.join(" ")}`);
				fail("failed", "OpenAI returned an empty answer.");
			}

			const citations = collectSources([...cited, ...extractUrls(text).map((url) => ({ url }))]);
			const sources = searched ? collectSources([...consulted, ...citations]) : [];
			const usage = parsed.data.usage
				? {
						inputTokens: parsed.data.usage.input_tokens ?? 0,
						outputTokens: parsed.data.usage.output_tokens ?? 0,
						searches,
					}
				: null;

			return {
				engine: "openai",
				model: parsed.data.model ?? o.model,
				text,
				citations,
				sources,
				searched,
				usage,
				durationMs: Date.now() - started,
			};
		},
	};
}
