import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseClaudeStream } from "../src/providers/claude-parse";
import { ProviderError } from "../src/types";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "fixtures", name), "utf8");

function codeOf(run: () => unknown) {
	try {
		run();
	} catch (error) {
		if (error instanceof ProviderError) return error.code;
		throw error;
	}
	return null;
}

const errorResult = (text: string) => `${JSON.stringify({ type: "result", subtype: "success", is_error: true, result: text })}\n`;

test("parses a searched answer with sources and citations", () => {
	const answer = parseClaudeStream(fixture("claude-search.jsonl"), 22_000);
	expect(answer.engine).toBe("claude-cli");
	expect(answer.model).toBe("claude-opus-5-5");
	expect(answer.searched).toBe(true);
	expect(answer.text.length).toBe(2486);
	expect(answer.sources.length).toBe(18);
	expect(answer.sources.every((s) => s.domain.length > 0)).toBe(true);
	expect(answer.citations.length).toBe(8);
	expect(answer.durationMs).toBe(22_000);
	expect(answer.usage).toEqual({ inputTokens: 8284, outputTokens: 1137, searches: 1 });
});

test("citations take their title from the matching source", () => {
	const answer = parseClaudeStream(fixture("claude-search.jsonl"), 1);
	const cited = answer.citations.find((c) => c.url === "https://attio.com/f/best-crm-for-agencies");
	expect(cited?.title).toBe("9 min read");
	expect(cited?.domain).toBe("attio.com");
});

test("an answer from memory is not an error", () => {
	const answer = parseClaudeStream(fixture("claude-no-search.jsonl"), 1);
	expect(answer.searched).toBe(false);
	expect(answer.sources).toEqual([]);
	expect(answer.citations).toEqual([]);
	expect(answer.text).toBe("Paris is the capital of France.");
	expect(answer.usage).toEqual({ inputTokens: 105, outputTokens: 9, searches: 0 });
});

test("skips garbage and truncated lines", () => {
	const lines = fixture("claude-search.jsonl").split("\n");
	lines.splice(1, 0, "garbage line", '{"type":"user","tool_use_result":{"resu');
	const answer = parseClaudeStream(lines.join("\n"), 1);
	expect(answer.sources.length).toBe(18);
	expect(answer.citations.length).toBe(8);
});

test("tolerates a search result with an unexpected shape", () => {
	const odd = `${JSON.stringify({ type: "user", tool_use_result: { searchCount: 1, results: ["text only", { content: "nope" }, 7] } })}\n`;
	const answer = parseClaudeStream(odd + fixture("claude-no-search.jsonl"), 1);
	expect(answer.searched).toBe(true);
	expect(answer.sources).toEqual([]);
});

test("output without a result event fails", () => {
	const noResult = fixture("claude-search.jsonl").split("\n").filter((l) => !l.includes('"type":"result"')).join("\n");
	expect(codeOf(() => parseClaudeStream(noResult, 1))).toBe("failed");
	expect(codeOf(() => parseClaudeStream("", 1))).toBe("failed");
});

test("a login error is reported as not_logged_in", () => {
	expect(codeOf(() => parseClaudeStream(errorResult("Invalid API key · Please run /login"), 1))).toBe("not_logged_in");
});

test("a limit error is reported as rate_limited", () => {
	expect(codeOf(() => parseClaudeStream(errorResult("Claude usage limit reached. Your limit will reset at 3pm."), 1))).toBe("rate_limited");
	expect(codeOf(() => parseClaudeStream(errorResult("API Error: 429 rate limit exceeded"), 1))).toBe("rate_limited");
});

test("any other error result fails with its text", () => {
	try {
		parseClaudeStream(errorResult("Something odd happened"), 1);
		throw new Error("expected a throw");
	} catch (error) {
		expect(error).toBeInstanceOf(ProviderError);
		expect((error as ProviderError).code).toBe("failed");
		expect((error as ProviderError).message).toContain("Something odd happened");
	}
});
