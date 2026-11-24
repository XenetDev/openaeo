import { expect, test } from "bun:test";
import { AnswerSchema, ProviderError } from "../src/index";

const full = {
	engine: "claude-cli",
	model: "claude-opus-5-5",
	text: "HubSpot is a good default.",
	citations: [{ url: "https://hubspot.com/pricing", domain: "hubspot.com", title: "Pricing" }],
	sources: [{ url: "https://hubspot.com/pricing", domain: "hubspot.com" }],
	searched: true,
	usage: { inputTokens: 10, outputTokens: 20, searches: 1 },
	durationMs: 1200,
};

test("AnswerSchema accepts a full answer", () => {
	expect(AnswerSchema.parse(full)).toEqual(full);
});

test("AnswerSchema accepts null model and usage", () => {
	const parsed = AnswerSchema.parse({ ...full, model: null, usage: null });
	expect(parsed.model).toBeNull();
	expect(parsed.usage).toBeNull();
});

test("AnswerSchema rejects an unknown engine", () => {
	expect(() => AnswerSchema.parse({ ...full, engine: "bing" })).toThrow();
});

test("ProviderError carries engine and code", () => {
	const error = new ProviderError("codex-cli", "cli_outdated", "msg");
	expect(error).toBeInstanceOf(Error);
	expect(error.code).toBe("cli_outdated");
	expect(error.engine).toBe("codex-cli");
	expect(error.message).toBe("msg");
});
