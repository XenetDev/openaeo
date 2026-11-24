import { expect, test } from "bun:test";
import { buildProviders, detectEngines } from "../src/engines";
import { freshStore } from "./helpers";

const which = (found: string[]) => (bin: string) => (found.includes(bin) ? `/usr/bin/${bin}` : null);

test("installed tools are available and enabled by default", () => {
	const engines = detectEngines({ store: freshStore(), which: which(["claude", "codex"]) });
	expect(engines.map((e) => [e.id, e.label, e.available, e.enabled])).toEqual([
		["claude-cli", "Claude", true, true],
		["codex-cli", "ChatGPT (Codex)", true, true],
		["openai", "OpenAI API", false, true],
		["anthropic", "Anthropic API", false, true],
		["xai", "Grok (xAI API)", false, true],
		["gemini", "Gemini API", false, true],
		["perplexity", "Perplexity API", false, true],
	]);
	expect(engines[0]?.reason).toBeNull();
});

test("a missing tool says what to install", () => {
	const engines = detectEngines({ store: freshStore(), which: which(["codex"]) });
	const claude = engines.find((e) => e.id === "claude-cli");
	expect(claude?.available).toBe(false);
	expect(claude?.reason).toMatch(/Claude Code/);
	expect(buildProviders({ store: freshStore(), which: which(["codex"]) }).map((p) => p.id)).toEqual(["codex-cli"]);
});

test("a disabled engine is left out of runs but still listed", () => {
	const store = freshStore();
	store.settings.set("engine.codex-cli.enabled", "false");
	const deps = { store, which: which(["claude", "codex"]) };
	expect(detectEngines(deps).find((e) => e.id === "codex-cli")).toMatchObject({ available: true, enabled: false });
	expect(buildProviders(deps).map((p) => p.id)).toEqual(["claude-cli"]);
});

test("an API engine is ready as soon as it has a key, using a default model", () => {
	const store = freshStore();
	const deps = { store, which: which([]) };
	expect(detectEngines(deps).find((e) => e.id === "xai")).toMatchObject({ available: false });
	expect(detectEngines(deps).find((e) => e.id === "xai")?.reason).toMatch(/xAI API key/);
	store.settings.set("xai.apiKey", "xai-1");
	store.settings.set("openai.apiKey", "sk-1");
	expect(detectEngines(deps).find((e) => e.id === "xai")).toMatchObject({ available: true, reason: null });
	expect(buildProviders(deps).map((p) => p.id)).toEqual(["openai", "xai"]);
});

test("with nothing installed there are no providers", () => {
	expect(buildProviders({ store: freshStore(), which: which([]) })).toEqual([]);
});
