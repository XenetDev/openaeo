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
	error: z.object({ message: z.string().optional(), code: z.string().nullish() }).optional(),
});

const TailSchema = z.object({
	detail: z.string().optional(),
	message: z.string().optional(),
	error: z.union([z.string(), z.object({ message: z.string().optional() })]).optional(),
});

function textOf(json: unknown): string | null {
	const tail = TailSchema.safeParse(json);
	if (!tail.success) return null;
	const nested = typeof tail.data.error === "string" ? tail.data.error : tail.data.error?.message;
	return nested ?? tail.data.detail ?? tail.data.message ?? null;
}

function unwrap(raw: string): { text: string; status?: number; code?: string } {
	const brace = raw.indexOf("{");
	if (brace === -1) return { text: raw.trim() };
	const head = raw.slice(0, brace).trim();
	let json: unknown = null;
	try {
		json = JSON.parse(raw.slice(brace));
	} catch {}
	const wrapped = WrappedSchema.safeParse(json);
	const inner = textOf(json);
	const text = [head, inner].filter(Boolean).join(" ").replace(/[{}]/g, "").trim();
	return {
		text: text || "Codex reported an error it did not describe.",
		status: wrapped.success ? wrapped.data.status : undefined,
		code: wrapped.success ? (wrapped.data.error?.code ?? undefined) : undefined,
	};
}

function classify(error: { text: string; status?: number; code?: string }): ProviderErrorCode {
	if (/requires a newer version/i.test(error.text)) return "cli_outdated";
	if (error.code === "model_not_found" || /model\b[^.]{0,80}\bis not supported|model_not_found/i.test(error.text)) return "model_unavailable";
	if (error.status === 429 || /\busage limit\b|\brate limit/i.test(error.text)) return "rate_limited";
	if (error.status === 401 || /\bnot logged in\b|\bplease log in\b|\bcodex login\b|\bunauthorized\b/i.test(error.text)) return "not_logged_in";
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

	if (failure !== null) {
		const detail = unwrap(failure);
		const code = classify(detail);
		throw new ProviderError("codex-cli", code, [detail.text, ADVICE[code]].filter(Boolean).join(" "));
	}
	const text = messages.at(-1) ?? "";
	if (!text.trim()) throw new ProviderError("codex-cli", "failed", "Codex exited without an answer.");

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
