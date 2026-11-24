import { z } from "zod";
import { type Answer, ProviderError, type ProviderErrorCode } from "../types";
import { citationsFrom, collectSources, parseJsonLines } from "./jsonl";

const AssistantSchema = z.object({
	type: z.literal("assistant"),
	message: z.object({ model: z.string() }),
});

const HitSchema = z.object({ url: z.string(), title: z.string().optional() });

const SearchSchema = z.object({
	type: z.literal("user"),
	tool_use_result: z.object({
		searchCount: z.number().optional(),
		results: z.array(z.unknown()),
	}),
});

const ResultSchema = z.object({
	type: z.literal("result"),
	is_error: z.boolean().optional(),
	subtype: z.string().optional(),
	result: z.string().optional(),
	usage: z
		.object({
			input_tokens: z.number().optional(),
			cache_creation_input_tokens: z.number().optional(),
			cache_read_input_tokens: z.number().optional(),
			output_tokens: z.number().optional(),
		})
		.optional(),
});

function classify(text: string): ProviderErrorCode {
	if (/unknown option|unknown argument|unrecognized option/i.test(text)) return "cli_outdated";
	if (/please run \/login|invalid api key|not logged in|authentication_error|oauth token (has )?expired/i.test(text))
		return "not_logged_in";
	if (
		/issue with the selected model|model[^.]{0,80}(not exist|not found|not available|not supported)|invalid model/i.test(
			text,
		)
	)
		return "model_unavailable";
	if (/rate limit|usage limit|\b429\b|overloaded/i.test(text)) return "rate_limited";
	return "failed";
}

const MESSAGES: Partial<Record<ProviderErrorCode, string>> = {
	cli_outdated: "This version of Claude Code is too old for OpenAEO. Update Claude Code and try again.",
	not_logged_in: "Claude Code is not logged in. Run `claude` and use /login, then try again.",
};

export function claudeError(text: string, knownOnly = false): ProviderError | null {
	const code = classify(text);
	if (code === "failed" && knownOnly) return null;
	const detail = text.trim().slice(-400);
	const message =
		MESSAGES[code] ??
		(code === "rate_limited"
			? `Claude Code hit a usage limit: ${detail}`
			: code === "model_unavailable"
				? `Claude Code cannot use that model on this account: ${detail}`
				: `Claude Code returned an error: ${detail}`);
	return new ProviderError("claude-cli", code, message);
}

function hits(results: unknown[]): { url: string; title?: string }[] {
	const found: { url: string; title?: string }[] = [];
	for (const entry of results) {
		const content = z.object({ content: z.array(z.unknown()) }).safeParse(entry);
		if (!content.success) continue;
		for (const item of content.data.content) {
			const hit = HitSchema.safeParse(item);
			if (hit.success) found.push(hit.data);
		}
	}
	return found;
}

export function parseClaudeStream(stdout: string, durationMs: number): Answer {
	let model: string | null = null;
	let searches = 0;
	let searched = false;
	const found: { url: string; title?: string }[] = [];
	let result: z.infer<typeof ResultSchema> | null = null;

	for (const event of parseJsonLines(stdout)) {
		const assistant = AssistantSchema.safeParse(event);
		if (assistant.success) {
			model ??= assistant.data.message.model;
			continue;
		}
		const search = SearchSchema.safeParse(event);
		if (search.success) {
			searched = true;
			searches += search.data.tool_use_result.searchCount ?? 1;
			found.push(...hits(search.data.tool_use_result.results));
			continue;
		}
		const final = ResultSchema.safeParse(event);
		if (final.success) result = final.data;
	}

	if (!result) throw new ProviderError("claude-cli", "failed", "Claude Code exited without an answer.");
	const text = result.result ?? "";
	if (result.is_error) {
		const detail = text.trim() || `the run stopped early (${result.subtype ?? "unknown reason"})`;
		throw claudeError(detail) ?? new ProviderError("claude-cli", "failed", detail);
	}
	if (!text.trim()) throw new ProviderError("claude-cli", "failed", "Claude Code returned an empty answer.");

	const sources = collectSources(found);
	const usage = result.usage
		? {
				inputTokens:
					(result.usage.input_tokens ?? 0) +
					(result.usage.cache_creation_input_tokens ?? 0) +
					(result.usage.cache_read_input_tokens ?? 0),
				outputTokens: result.usage.output_tokens ?? 0,
				searches,
			}
		: null;

	return {
		engine: "claude-cli",
		model,
		text,
		citations: citationsFrom(text, sources),
		sources,
		searched,
		usage,
		durationMs,
	};
}
