import {
	ANTHROPIC_DEFAULT_MODEL,
	createAnthropic,
	createGemini,
	createOpenAI,
	createPerplexity,
	createXai,
	type EngineId,
	GEMINI_DEFAULT_MODEL,
	OPENAI_DEFAULT_MODEL,
	PERPLEXITY_DEFAULT_MODEL,
	type Provider,
	XAI_DEFAULT_MODEL,
} from "@openaeo/engine";
import { createClaudeCli, createCodexCli } from "@openaeo/engine/cli";
import type { Store } from "./store/store";

export type EngineStatus = {
	id: EngineId;
	label: string;
	available: boolean;
	reason: string | null;
	enabled: boolean;
	api: { name: string; defaultModel: string } | null;
};

export type EngineDeps = { store: Store; which: (bin: string) => string | null };

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

type Definition = { id: EngineId; reason: (deps: EngineDeps) => string | null; build: (deps: EngineDeps) => Provider };

const setting = (deps: EngineDeps, key: string) => deps.store.settings.get(key)?.trim() || undefined;

const DEFINITIONS: Definition[] = [
	{
		id: "claude-cli",
		reason: (deps) =>
			deps.which("claude") ? null : "Claude Code is not installed. Install it and log in, then reopen OpenAEO.",
		build: (deps) => createClaudeCli({ model: setting(deps, "claude.model") }),
	},
	{
		id: "codex-cli",
		reason: (deps) =>
			deps.which("codex") ? null : "The Codex CLI is not installed. Install it and log in, then reopen OpenAEO.",
		build: (deps) => createCodexCli({ model: setting(deps, "codex.model") }),
	},
	...API_ENGINES.map(
		(api): Definition => ({
			id: api.id,
			reason: (deps) => (setting(deps, `${api.id}.apiKey`) ? null : `Add your ${api.name} API key to use this engine.`),
			build: (deps) => {
				const options = {
					apiKey: setting(deps, `${api.id}.apiKey`) ?? "",
					model: setting(deps, `${api.id}.model`) ?? api.model,
				};
				if (api.id === "openai") return createOpenAI(options);
				if (api.id === "anthropic") return createAnthropic(options);
				if (api.id === "xai") return createXai(options);
				if (api.id === "gemini") return createGemini(options);
				return createPerplexity(options);
			},
		}),
	),
];

function apiOf(id: EngineId): EngineStatus["api"] {
	const found = API_ENGINES.find((api) => api.id === id);
	return found ? { name: found.name, defaultModel: found.model } : null;
}

const enabled = (deps: EngineDeps, id: EngineId) => deps.store.settings.get(`engine.${id}.enabled`) !== "false";

export function detectEngines(deps: EngineDeps): EngineStatus[] {
	return DEFINITIONS.map((definition) => {
		const reason = definition.reason(deps);
		return {
			id: definition.id,
			label: ENGINE_LABELS[definition.id] ?? definition.id,
			available: reason === null,
			reason,
			enabled: enabled(deps, definition.id),
			api: apiOf(definition.id),
		};
	});
}

export function buildProviders(deps: EngineDeps): Provider[] {
	return DEFINITIONS.filter((d) => d.reason(deps) === null && enabled(deps, d.id)).map((d) => d.build(deps));
}
