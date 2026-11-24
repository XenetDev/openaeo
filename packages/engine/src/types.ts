import { z } from "zod";

export const EngineIdSchema = z.enum(["claude-cli", "codex-cli", "openai", "anthropic", "gemini", "perplexity", "xai"]);
export type EngineId = z.infer<typeof EngineIdSchema>;

export const SourceSchema = z.object({
	url: z.string(),
	domain: z.string(),
	title: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const UsageSchema = z.object({
	inputTokens: z.number(),
	outputTokens: z.number(),
	searches: z.number(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const AnswerSchema = z.object({
	engine: EngineIdSchema,
	model: z.string().nullable(),
	text: z.string(),
	citations: z.array(SourceSchema),
	sources: z.array(SourceSchema),
	searched: z.boolean(),
	usage: UsageSchema.nullable(),
	durationMs: z.number(),
});
export type Answer = z.infer<typeof AnswerSchema>;

export type AskOptions = { signal?: AbortSignal; timeoutMs?: number };

export interface Provider {
	id: EngineId;
	ask(prompt: string, opts?: AskOptions): Promise<Answer>;
}

export const ProviderErrorCodeSchema = z.enum([
	"not_installed",
	"not_logged_in",
	"cli_outdated",
	"model_unavailable",
	"rate_limited",
	"timeout",
	"failed",
]);
export type ProviderErrorCode = z.infer<typeof ProviderErrorCodeSchema>;

export class ProviderError extends Error {
	readonly engine: EngineId;
	readonly code: ProviderErrorCode;

	constructor(engine: EngineId, code: ProviderErrorCode, message: string) {
		super(message);
		this.name = "ProviderError";
		this.engine = engine;
		this.code = code;
	}
}
