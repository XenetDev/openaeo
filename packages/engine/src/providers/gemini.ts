import type { Answer, AskOptions, Provider } from "../types";
import { type ApiOptions, failWith, finish, type Found, list, num, postJson, rec, str } from "./http";

export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function createGemini(o: ApiOptions): Provider {
	const model = o.model || GEMINI_DEFAULT_MODEL;
	const url = `${(o.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "")}/models/${encodeURIComponent(model)}:generateContent`;
	return {
		id: "gemini",
		async ask(prompt: string, opts: AskOptions = {}): Promise<Answer> {
			const started = Date.now();
			const res = await postJson({ engine: "gemini", label: "Gemini", fetcher: o.fetch ?? fetch, url, headers: { "x-goog-api-key": o.apiKey }, body: { contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }, apiKey: o.apiKey, opts });
			const body = rec(res.json);
			if (!res.ok) {
				const error = rec(body.error);
				const detail = res.redact(str(error.message));
				const badKey = list(error.details).some((d) => rec(d).reason === "API_KEY_INVALID");
				if (badKey || res.status === 401 || res.status === 403) failWith("gemini", "not_logged_in", "Google rejected the Gemini API key. Check the key and try again.");
				if (res.status === 429 || res.status === 402) failWith("gemini", "rate_limited", `Gemini rate limit reached or credits used up. ${detail}`.trim());
				if (res.status === 404) failWith("gemini", "model_unavailable", `Gemini model \`${model}\` is not available to this key. ${detail}`.trim());
				failWith("gemini", "failed", `Gemini returned HTTP ${res.status}. ${detail}`.trim());
			}
			const candidate = rec(list(body.candidates)[0]);
			const text = list(rec(candidate.content).parts)
				.filter((part) => rec(part).thought !== true)
				.map((part) => str(rec(part).text))
				.join("");
			const grounding = rec(candidate.groundingMetadata);
			const consulted: Found[] = [];
			for (const chunk of list(grounding.groundingChunks)) {
				const web = rec(rec(chunk).web);
				const uri = str(web.uri);
				const title = str(web.title);
				if (!uri) continue;
				consulted.push(/vertexaisearch\.cloud\.google\.com/i.test(uri) && DOMAIN.test(title) ? { url: `https://${title}`, title } : { url: uri, title: title || undefined });
			}
			const searches = list(grounding.webSearchQueries).length;
			const usage = rec(body.usageMetadata);
			return finish({
				engine: "gemini",
				label: "Gemini",
				model: str(body.modelVersion) || model,
				text,
				cited: consulted,
				consulted,
				searched: consulted.length > 0 || searches > 0,
				usage: body.usageMetadata ? { inputTokens: num(usage.promptTokenCount), outputTokens: num(usage.candidatesTokenCount) + num(usage.thoughtsTokenCount), searches } : null,
				started,
			});
		},
	};
}
