import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCodexStream } from "../src/providers/codex-parse";
import { ProviderError } from "../src/types";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "fixtures", name), "utf8");

function errorOf(run: () => unknown): ProviderError {
	try {
		run();
	} catch (error) {
		if (error instanceof ProviderError) return error;
		throw error;
	}
	throw new Error("expected a ProviderError");
}

const line = (value: unknown) => `${JSON.stringify(value)}\n`;
const failure = (message: string) => line({ type: "error", message }) + line({ type: "turn.failed", error: { message } });

test("parses a searched answer", () => {
	const answer = parseCodexStream(fixture("codex-search.jsonl"), 39_900);
	expect(answer.engine).toBe("codex-cli");
	expect(answer.model).toBeNull();
	expect(answer.searched).toBe(true);
	expect(answer.text.startsWith("**My default pick is Pipedrive")).toBe(true);
	expect(answer.text).not.toContain("I’ll compare");
	expect(answer.text).toContain("Pipedrive");
	expect(answer.citations.length).toBe(4);
	expect(answer.sources.length).toBe(39);
	expect(new Set(answer.sources.map((s) => s.url)).size).toBe(39);
	expect(answer.usage).toEqual({ inputTokens: 89036, outputTokens: 644, searches: 4 });
	expect(answer.durationMs).toBe(39_900);
});

test("sources carry titles and domains", () => {
	const answer = parseCodexStream(fixture("codex-search.jsonl"), 1);
	const source = answer.sources.find((s) => s.url === "https://www.gohighlevel.com/pricing");
	expect(source?.domain).toBe("gohighlevel.com");
	expect(source?.title).toBe("HighLevel Pricing");
});

test("opening a page without a search still counts as searched", () => {
	const stdout =
		line({ type: "item.completed", item: { type: "web_search", action: { type: "open_page", url: "https://a.com/x" }, results: [{ type: "text_result", url: "https://a.com/x", title: "A" }] } }) +
		line({ type: "item.completed", item: { type: "agent_message", text: "Answer." } });
	const answer = parseCodexStream(stdout, 1);
	expect(answer.searched).toBe(true);
	expect(answer.sources).toEqual([{ url: "https://a.com/x", domain: "a.com", title: "A" }]);
	expect(answer.usage).toBeNull();
});

test("an answer from memory is not an error", () => {
	const answer = parseCodexStream(line({ type: "item.completed", item: { type: "agent_message", text: "Paris." } }), 1);
	expect(answer.searched).toBe(false);
	expect(answer.sources).toEqual([]);
	expect(answer.citations).toEqual([]);
});

test("skips garbage and truncated lines", () => {
	const lines = fixture("codex-search.jsonl").split("\n");
	lines.splice(1, 0, "Reading additional input from stdin...", '{"type":"item.completed","item":{"ty');
	expect(parseCodexStream(lines.join("\n"), 1).citations.length).toBe(4);
});

test("an outdated CLI is reported as cli_outdated", () => {
	const error = errorOf(() => parseCodexStream(fixture("codex-outdated.jsonl"), 1));
	expect(error.code).toBe("cli_outdated");
	expect(error.message).toContain("gpt-6-astra");
	expect(error.message).not.toMatch(/[{}]/);
});

test("a model outside the plan is reported as model_unavailable", () => {
	const error = errorOf(() => parseCodexStream(fixture("codex-model-unavailable.jsonl"), 1));
	expect(error.code).toBe("model_unavailable");
	expect(error.message).toContain("gpt-5.5");
	expect(error.message).not.toMatch(/[{}]/);
});

test("limit and login failures are classified", () => {
	expect(errorOf(() => parseCodexStream(failure("You've hit your usage limit. Try again at 4pm."), 1)).code).toBe("rate_limited");
	expect(errorOf(() => parseCodexStream(failure(JSON.stringify({ status: 429, error: { message: "Too many requests" } })), 1)).code).toBe("rate_limited");
	expect(errorOf(() => parseCodexStream(failure(JSON.stringify({ status: 401, error: { message: "Unauthorized" } })), 1)).code).toBe("not_logged_in");
	expect(errorOf(() => parseCodexStream(failure("Not logged in. Please log in with `codex login`."), 1)).code).toBe("not_logged_in");
});

test("a plain-text error message is passed through", () => {
	const error = errorOf(() => parseCodexStream(failure("stream disconnected before completion"), 1));
	expect(error.code).toBe("failed");
	expect(error.message).toContain("stream disconnected before completion");
});

test("output with neither an answer nor an error fails", () => {
	expect(errorOf(() => parseCodexStream(line({ type: "thread.started" }), 1)).code).toBe("failed");
	expect(errorOf(() => parseCodexStream("", 1)).code).toBe("failed");
});
