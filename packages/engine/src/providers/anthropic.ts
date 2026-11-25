import type { Answer, AskOptions, Provider } from "../types";
import { type ApiOptions, type Found, failWith, finish, list, num, postJson, rec, str } from "./http";

export const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5-5";
const VERSION = "2023-06-01";

export function createAnthropic(o: ApiOptions): Provider {
	const model = o.model || ANTHROPIC_DEFAULT_MODEL;
	const url = `${(o.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/+$/, "")}/messages`;
	return {
		id: "anthropic",
		async ask(prompt: string, opts: AskOptions = {}): Promise<Answer> {
			const started = Date.now();
			const res = await postJson({
				engine: "anthropic",
				label: "Anthropic",
				fetcher: o.fetch ?? fetch,
				url,
				headers: { "x-api-key": o.apiKey, "anthropic-version": VERSION },
				body: {
					model,
					max_tokens: 4096,
					messages: [{ role: "user", content: prompt }],
					tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
				},
				apiKey: o.apiKey,
				opts,
			});
			const body = rec(res.json);
			if (!res.ok) {
				const detail = res.redact(str(rec(body.error).message));
				if (res.status === 401 || res.status === 403)
					failWith("anthropic", "not_logged_in", "Anthropic rejected the API key. Check the key and try again.");
				if (res.status === 429 || res.status === 529)
					failWith("anthropic", "rate_limited", `Anthropic is rate limiting or overloaded. ${detail}`.trim());
				if (res.status === 404)
					failWith(
						"anthropic",
						"model_unavailable",
						`Anthropic model \`${model}\` is not available to this key. ${detail}`.trim(),
					);
				failWith("anthropic", "failed", `Anthropic returned HTTP ${res.status}. ${detail}`.trim());
			}
			if (body.stop_reason === "refusal")
				failWith("anthropic", "failed", "Anthropic declined to answer this question.");
			let text = "";
			const cited: Found[] = [];
			const consulted: Found[] = [];
			let searched = false;
			for (const item of list(body.content)) {
				const block = rec(item);
				if (block.type === "server_tool_use") searched = true;
				if (block.type === "web_search_tool_result") {
					searched = true;
					for (const result of list(block.content))
						if (str(rec(result).url))
							consulted.push({ url: str(rec(result).url), title: str(rec(result).title) || undefined });
				}
				if (block.type !== "text") continue;
				text += str(block.text);
				for (const citation of list(block.citations))
					if (str(rec(citation).url))
						cited.push({ url: str(rec(citation).url), title: str(rec(citation).title) || undefined });
			}
			const usage = rec(body.usage);
			return finish({
				engine: "anthropic",
				label: "Anthropic",
				model: str(body.model) || model,
				text,
				cited,
				consulted,
				searched,
				usage: body.usage
					? {
							inputTokens: num(usage.input_tokens),
							outputTokens: num(usage.output_tokens),
							searches: num(rec(usage.server_tool_use).web_search_requests),
						}
					: null,
				started,
			});
		},
	};
}
