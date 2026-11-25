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
import type { Awaitable, Store } from "./store/store";

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

type Definition = {
	id: EngineId;
	reason: (deps: EngineDeps) => Awaitable<string | null>;
	build: (deps: EngineDeps) => Promise<Provider>;
};

const setting = async (deps: EngineDeps, key: string) => (await deps.store.settings.get(key))?.trim() || undefined;

const DEFINITIONS: Definition[] = [
	{
		id: "claude-cli",
		reason: (deps) =>
			deps.which("claude") ? null : "Claude Code is not installed. Install it and log in, then reopen OpenAEO.",
		build: async (deps) => createClaudeCli({ model: await setting(deps, "claude.model") }),
	},
	{
		id: "codex-cli",
		reason: (deps) =>
			deps.which("codex") ? null : "The Codex CLI is not installed. Install it and log in, then reopen OpenAEO.",
		build: async (deps) => createCodexCli({ model: await setting(deps, "codex.model") }),
	},
	...API_ENGINES.map(
		(api): Definition => ({
			id: api.id,
			reason: async (deps) =>
				(await setting(deps, `${api.id}.apiKey`)) ? null : `Add your ${api.name} API key to use this engine.`,
			build: async (deps) => {
				const options = {
					apiKey: (await setting(deps, `${api.id}.apiKey`)) ?? "",
					model: (await setting(deps, `${api.id}.model`)) ?? api.model,
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

const enabled = async (deps: EngineDeps, id: EngineId) =>
	(await deps.store.settings.get(`engine.${id}.enabled`)) !== "false";

export function detectEngines(deps: EngineDeps): Promise<EngineStatus[]> {
	return Promise.all(
		DEFINITIONS.map(async (definition) => {
			const reason = await definition.reason(deps);
			return {
				id: definition.id,
				label: ENGINE_LABELS[definition.id] ?? definition.id,
				available: reason === null,
				reason,
				enabled: await enabled(deps, definition.id),
				api: apiOf(definition.id),
			};
		}),
	);
}

export async function buildProviders(deps: EngineDeps): Promise<Provider[]> {
	const providers: Provider[] = [];
	for (const definition of DEFINITIONS) {
		if ((await definition.reason(deps)) !== null || !(await enabled(deps, definition.id))) continue;
		providers.push(await definition.build(deps));
	}
	return providers;
}
