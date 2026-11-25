import type { Answer, AskOptions, Provider } from "../types";
import { type ApiOptions, type Found, failWith, finish, list, num, postJson, rec, str } from "./http";

export const PERPLEXITY_DEFAULT_MODEL = "perplexity/sonar";

export function createPerplexity(o: ApiOptions): Provider {
	const model = o.model || PERPLEXITY_DEFAULT_MODEL;
	const url = `${(o.baseUrl ?? "https://api.perplexity.ai/v1").replace(/\/+$/, "")}/agent`;
	return {
		id: "perplexity",
		async ask(prompt: string, opts: AskOptions = {}): Promise<Answer> {
			const started = Date.now();
			const res = await postJson({
				engine: "perplexity",
				label: "Perplexity",
				fetcher: o.fetch ?? fetch,
				url,
				headers: { authorization: `Bearer ${o.apiKey}` },
				body: { model, input: prompt, tools: [{ type: "web_search" }], stream: false },
				apiKey: o.apiKey,
				opts,
			});
			const body = rec(res.json);
			if (!res.ok) {
				const detail = res.redact(str(rec(body.error).message));
				if (res.status === 403 && (str(rec(body.error).type) === "restricted_api_key" || /credit/i.test(detail)))
					failWith(
						"perplexity",
						"rate_limited",
						`Perplexity needs paid credits on this account before it answers. ${detail}`.trim(),
					);
				if (res.status === 401 || res.status === 403)
					failWith("perplexity", "not_logged_in", "Perplexity rejected the API key. Check the key and try again.");
				if (res.status === 429 || res.status === 402)
					failWith("perplexity", "rate_limited", `Perplexity rate limit reached or credits used up. ${detail}`.trim());
				if (res.status === 404 || /model/i.test(detail))
					failWith(
						"perplexity",
						"model_unavailable",
						`Perplexity model \`${model}\` is not available to this key. ${detail}`.trim(),
					);
				failWith("perplexity", "failed", `Perplexity returned HTTP ${res.status}. ${detail}`.trim());
			}
			const texts: string[] = [];
			const byId = new Map<string, Found>();
			const consulted: Found[] = [];
			let searched = false;
			for (const item of list(body.output)) {
				const entry = rec(item);
				if (entry.type === "search_results") {
					searched = true;
					for (const result of list(entry.results)) {
						const found = { url: str(rec(result).url), title: str(rec(result).title) || undefined };
						if (!found.url) continue;
						consulted.push(found);
						byId.set(String(rec(result).id), found);
					}
				}
				if (entry.type !== "message") continue;
				for (const block of list(entry.content))
					if (rec(block).type === "output_text") texts.push(str(rec(block).text));
			}
			const cited: Found[] = [];
			const text = texts.join("\n\n").replace(/\s*\[(?:web:)?(\d+)\]/g, (whole, id: string) => {
				const found = byId.get(id);
				if (!found) return whole;
				cited.push(found);
				return ` ${found.url}`;
			});
			const usage = rec(body.usage);
			return finish({
				engine: "perplexity",
				label: "Perplexity",
				model: str(body.model) || model,
				text,
				cited,
				consulted,
				searched,
				usage: body.usage
					? {
							inputTokens: num(usage.input_tokens),
							outputTokens: num(usage.output_tokens),
							searches: num(rec(rec(usage.tool_calls_details).search_web).invocation),
						}
					: null,
				started,
			});
		},
	};
}
