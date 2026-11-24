import type { Answer, AskOptions, Provider } from "../types";
import { type ApiOptions, type Found, failWith, finish, list, num, postJson, rec, str } from "./http";

export const XAI_DEFAULT_MODEL = "grok-4.7";

export function createXai(o: ApiOptions): Provider {
	const model = o.model || XAI_DEFAULT_MODEL;
	const url = `${(o.baseUrl ?? "https://api.x.ai/v1").replace(/\/+$/, "")}/responses`;
	return {
		id: "xai",
		async ask(prompt: string, opts: AskOptions = {}): Promise<Answer> {
			const started = Date.now();
			const res = await postJson({
				engine: "xai",
				label: "xAI",
				fetcher: o.fetch ?? fetch,
				url,
				headers: { authorization: `Bearer ${o.apiKey}` },
				body: {
					model,
					input: [{ role: "user", content: prompt }],
					tools: [{ type: "web_search" }],
					include: ["no_inline_citations"],
					stream: false,
					store: false,
				},
				apiKey: o.apiKey,
				opts,
			});
			const body = rec(res.json);
			if (!res.ok) {
				const detail = res.redact(str(body.error) || str(rec(body.error).message));
				if (res.status === 401 || res.status === 403 || /api key|credential/i.test(detail))
					failWith("xai", "not_logged_in", "xAI rejected the API key. Check the key and try again.");
				if (res.status === 429)
					failWith("xai", "rate_limited", `xAI rate limit or credit limit reached. ${detail}`.trim());
				if (res.status === 404 || /model/i.test(detail))
					failWith("xai", "model_unavailable", `xAI model \`${model}\` is not available to this key. ${detail}`.trim());
				failWith("xai", "failed", `xAI returned HTTP ${res.status}. ${detail}`.trim());
			}
			const texts: string[] = [];
			const cited: Found[] = [];
			const consulted: Found[] = [];
			let calls = 0;
			for (const item of list(body.output)) {
				const entry = rec(item);
				if (entry.type === "web_search_call") {
					calls += 1;
					for (const source of list(rec(entry.action).sources))
						if (str(rec(source).url)) consulted.push({ url: str(rec(source).url) });
				}
				if (entry.type !== "message") continue;
				for (const block of list(entry.content)) {
					const part = rec(block);
					if (part.type !== "output_text") continue;
					texts.push(str(part.text));
					for (const annotation of list(part.annotations))
						if (rec(annotation).type === "url_citation" && str(rec(annotation).url))
							cited.push({ url: str(rec(annotation).url) });
				}
			}
			const usage = rec(body.usage);
			const searches = num(rec(usage.server_side_tool_usage_details).web_search_calls) || calls;
			return finish({
				engine: "xai",
				label: "xAI",
				model: str(body.model) || model,
				text: texts.join("\n\n"),
				cited,
				consulted,
				searched: searches > 0 || cited.length > 0,
				usage: body.usage
					? { inputTokens: num(usage.input_tokens), outputTokens: num(usage.output_tokens), searches }
					: null,
				started,
			});
		},
	};
}
