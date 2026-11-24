import { z } from "zod";
import { type Answer, ProviderError, type ProviderErrorCode } from "../types";
import { citationsFrom, collectSources, parseJsonLines } from "./jsonl";

const MessageSchema = z.object({
	type: z.literal("item.completed"),
	item: z.object({ type: z.literal("agent_message"), text: z.string() }),
});

const SearchSchema = z.object({
	type: z.literal("item.completed"),
	item: z.object({
		type: z.literal("web_search"),
		action: z.object({ type: z.string().optional(), queries: z.array(z.unknown()).optional() }).optional(),
		results: z.array(z.unknown()).optional(),
	}),
});

const HitSchema = z.object({ url: z.string(), title: z.string().optional() });

const UsageSchema = z.object({
	type: z.literal("turn.completed"),
	usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() }),
});

const ErrorSchema = z.union([
	z.object({ type: z.literal("error"), message: z.string() }),
	z.object({ type: z.literal("turn.failed"), error: z.object({ message: z.string() }) }),
]);

const WrappedSchema = z.object({
	status: z.number().optional(),
	error: z.object({ message: z.string().optional(), code: z.string().optional() }).optional(),
});

function unwrap(raw: string): { text: string; status?: number; code?: string } {
	try {
		const wrapped = WrappedSchema.safeParse(JSON.parse(raw));
		if (wrapped.success && wrapped.data.error?.message) {
			return { text: wrapped.data.error.message, status: wrapped.data.status, code: wrapped.data.error.code };
		}
	} catch {}
	return { text: raw };
}

function classify(error: { text: string; status?: number; code?: string }): ProviderErrorCode {
	if (/requires a newer version/i.test(error.text)) return "cli_outdated";
	if (error.code === "model_not_found" || /is not supported|model_not_found/i.test(error.text)) return "model_unavailable";
	if (error.status === 429 || /usage limit|rate limit/i.test(error.text)) return "rate_limited";
	if (error.status === 401 || /log in|logged in|unauthorized/i.test(error.text)) return "not_logged_in";
	return "failed";
}

const ADVICE: Record<ProviderErrorCode, string> = {
	cli_outdated: "Update the Codex CLI and try again.",
	model_unavailable: "Choose a model your ChatGPT plan includes.",
	rate_limited: "Wait for the limit to reset, then try again.",
	not_logged_in: "Run `codex login`, then try again.",
	not_installed: "",
	timeout: "",
	failed: "",
};

export function parseCodexStream(stdout: string, durationMs: number): Answer {
	const messages: string[] = [];
	const found: { url: string; title?: string }[] = [];
	let searched = false;
	let searches = 0;
	let usage: Answer["usage"] = null;
	let failure: string | null = null;

	for (const event of parseJsonLines(stdout)) {
		const message = MessageSchema.safeParse(event);
		if (message.success) {
			messages.push(message.data.item.text);
			continue;
		}
		const search = SearchSchema.safeParse(event);
		if (search.success) {
			searched = true;
			const action = search.data.item.action;
			if (action?.type === "search") searches += Math.max(action.queries?.length ?? 0, 1);
			for (const result of search.data.item.results ?? []) {
				const hit = HitSchema.safeParse(result);
				if (hit.success) found.push(hit.data);
			}
			continue;
		}
		const turn = UsageSchema.safeParse(event);
		if (turn.success) {
			usage = { inputTokens: turn.data.usage.input_tokens ?? 0, outputTokens: turn.data.usage.output_tokens ?? 0, searches: 0 };
			continue;
		}
		const error = ErrorSchema.safeParse(event);
		if (error.success) failure ??= "message" in error.data ? error.data.message : error.data.error.message;
	}

	const text = messages.join("\n\n");
	if (!text.trim()) {
		if (failure === null) throw new ProviderError("codex-cli", "failed", "Codex exited without an answer.");
		const detail = unwrap(failure);
		const code = classify(detail);
		const clean = detail.text.replace(/[{}]/g, "").trim();
		throw new ProviderError("codex-cli", code, [clean, ADVICE[code]].filter(Boolean).join(" "));
	}

	const sources = collectSources(found);
	return {
		engine: "codex-cli",
		model: null,
		text,
		citations: citationsFrom(text, sources),
		sources,
		searched,
		usage: usage ? { ...usage, searches } : null,
		durationMs,
	};
}
