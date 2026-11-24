import { createOpenAI, type EngineId, type Provider } from "@openaeo/engine";
import { createClaudeCli, createCodexCli } from "@openaeo/engine/cli";
import type { Store } from "./store/store";

export type EngineStatus = { id: EngineId; label: string; available: boolean; reason: string | null; enabled: boolean };

export type EngineDeps = { store: Store; which: (bin: string) => string | null };

export const ENGINE_LABELS: Partial<Record<EngineId, string>> = {
	"claude-cli": "Claude",
	"codex-cli": "ChatGPT (Codex)",
	openai: "OpenAI API",
};

type Definition = { id: EngineId; reason: (deps: EngineDeps) => string | null; build: (deps: EngineDeps) => Provider };

const setting = (deps: EngineDeps, key: string) => deps.store.settings.get(key)?.trim() || undefined;

const DEFINITIONS: Definition[] = [
	{
		id: "claude-cli",
		reason: (deps) => (deps.which("claude") ? null : "Claude Code is not installed. Install it and log in, then reopen OpenAEO."),
		build: (deps) => createClaudeCli({ model: setting(deps, "claude.model") }),
	},
	{
		id: "codex-cli",
		reason: (deps) => (deps.which("codex") ? null : "The Codex CLI is not installed. Install it and log in, then reopen OpenAEO."),
		build: (deps) => createCodexCli({ model: setting(deps, "codex.model") }),
	},
	{
		id: "openai",
		reason: (deps) => {
			if (!setting(deps, "openai.apiKey")) return "Add an OpenAI API key in Settings to use this engine.";
			if (!setting(deps, "openai.model")) return "Choose an OpenAI model in Settings to use this engine.";
			return null;
		},
		build: (deps) => createOpenAI({ apiKey: setting(deps, "openai.apiKey") ?? "", model: setting(deps, "openai.model") ?? "" }),
	},
];

const enabled = (deps: EngineDeps, id: EngineId) => deps.store.settings.get(`engine.${id}.enabled`) !== "false";

export function detectEngines(deps: EngineDeps): EngineStatus[] {
	return DEFINITIONS.map((definition) => {
		const reason = definition.reason(deps);
		return { id: definition.id, label: ENGINE_LABELS[definition.id] ?? definition.id, available: reason === null, reason, enabled: enabled(deps, definition.id) };
	});
}

export function buildProviders(deps: EngineDeps): Provider[] {
	return DEFINITIONS.filter((d) => d.reason(deps) === null && enabled(deps, d.id)).map((d) => d.build(deps));
}
