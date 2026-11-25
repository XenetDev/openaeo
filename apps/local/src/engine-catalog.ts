import {
	ANTHROPIC_DEFAULT_MODEL,
	type EngineId,
	GEMINI_DEFAULT_MODEL,
	OPENAI_DEFAULT_MODEL,
	PERPLEXITY_DEFAULT_MODEL,
	XAI_DEFAULT_MODEL,
} from "@openaeo/engine";

export type EngineStatus = {
	id: EngineId;
	label: string;
	available: boolean;
	reason: string | null;
	enabled: boolean;
	api: { name: string; defaultModel: string } | null;
};

export const ENGINE_LABELS: Partial<Record<EngineId, string>> = {
	"claude-cli": "Claude",
	"codex-cli": "ChatGPT (Codex)",
	openai: "OpenAI API",
	anthropic: "Anthropic API",
	xai: "Grok (xAI API)",
	gemini: "Gemini API",
	perplexity: "Perplexity API",
};

export const API_ENGINES = [
	{ id: "openai", name: "OpenAI", model: OPENAI_DEFAULT_MODEL },
	{ id: "anthropic", name: "Anthropic", model: ANTHROPIC_DEFAULT_MODEL },
	{ id: "xai", name: "xAI (Grok)", model: XAI_DEFAULT_MODEL },
	{ id: "gemini", name: "Google Gemini", model: GEMINI_DEFAULT_MODEL },
	{ id: "perplexity", name: "Perplexity", model: PERPLEXITY_DEFAULT_MODEL },
] as const satisfies readonly { id: EngineId; name: string; model: string }[];

export const ENGINE_IDS = ["claude-cli", "codex-cli", ...API_ENGINES.map((api) => api.id)] as const;

export function apiOf(id: EngineId): EngineStatus["api"] {
	const found = API_ENGINES.find((api) => api.id === id);
	return found ? { name: found.name, defaultModel: found.model } : null;
}
