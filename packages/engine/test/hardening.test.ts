import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { createClaudeCli, createCodexCli, type Exec, type ExecResult, runCommand } from "../src/cli/index";
import type { MatchResult } from "../src/match";
import { match } from "../src/match";
import { parseCodexStream } from "../src/providers/codex-parse";
import { createOpenAI } from "../src/providers/openai";
import { metrics, visibility } from "../src/score";
import { ProviderError } from "../src/types";
import { extractUrls, normalizeUrl, toDomain } from "../src/url";

const line = (value: unknown) => `${JSON.stringify(value)}\n`;

async function errorOf(run: Promise<unknown> | (() => unknown)) {
	try {
		await (typeof run === "function" ? run() : run);
	} catch (error) {
		if (error instanceof ProviderError) return error;
		throw error;
	}
	throw new Error("expected a ProviderError");
}

function fakeExec(result: Partial<ExecResult>) {
	let calls = 0;
	const exec: Exec = async () => {
		calls += 1;
		return { code: 0, stdout: "", stderr: "", durationMs: 1, timedOut: false, ...result };
	};
	return { exec, calls: () => calls };
}

const claudeError = (text: string, extra: Record<string, unknown> = {}) =>
	line({ type: "result", subtype: "success", is_error: true, result: text, ...extra });
const claudeAsk = (result: Partial<ExecResult>) => errorOf(createClaudeCli({ exec: fakeExec(result).exec }).ask("q"));
const codexFailure = (message: string) =>
	line({ type: "error", message }) + line({ type: "turn.failed", error: { message } });

test("a timeout kills the whole process tree and returns promptly", async () => {
	const started = Date.now();
	const result = await runCommand("sh", ["-c", "sleep 3 & wait"], { cwd: tmpdir(), timeoutMs: 200 });
	expect(result.timedOut).toBe(true);
	expect(Date.now() - started).toBeLessThan(1500);
});

test("an abort kills the whole process tree and returns promptly", async () => {
	const controller = new AbortController();
	setTimeout(() => controller.abort(), 100);
	const started = Date.now();
	await runCommand("sh", ["-c", "sleep 3 & wait"], { cwd: tmpdir(), timeoutMs: 10_000, signal: controller.signal });
	expect(Date.now() - started).toBeLessThan(1500);
});

test("claude: a model outside the plan is model_unavailable", async () => {
	const error = await claudeAsk({
		stdout: claudeError(
			"There's an issue with the selected model (claude-foo). It may not exist or you may not have access to it.",
		),
	});
	expect(error.code).toBe("model_unavailable");
});

test("claude: an unknown flag means the CLI is too old", async () => {
	const error = await claudeAsk({ code: 1, stderr: "error: unknown option '--no-session-persistence'" });
	expect(error.code).toBe("cli_outdated");
	expect(error.message).toMatch(/update/i);
});

test("claude: a login message on stderr is not_logged_in", async () => {
	expect((await claudeAsk({ code: 1, stderr: "Invalid API key · Please run /login" })).code).toBe("not_logged_in");
});

test("claude: ordinary failures that mention login or authentication are not login errors", async () => {
	expect(
		(await claudeAsk({ stdout: claudeError("API Error: 500 the authentication service is unavailable") })).code,
	).toBe("failed");
	expect((await claudeAsk({ stdout: claudeError("timed out fetching https://example.com/login") })).code).toBe(
		"failed",
	);
});

test("claude: an error with no text still says what happened", async () => {
	const error = await claudeAsk({ stdout: line({ type: "result", subtype: "error_max_turns", is_error: true }) });
	expect(error.code).toBe("failed");
	expect(error.message).toContain("error_max_turns");
});

test("codex: unrelated messages are not misread as model or login errors", async () => {
	expect(
		(await errorOf(() => parseCodexStream(codexFailure("Sandbox mode read-only is not supported on this platform"), 1)))
			.code,
	).toBe("failed");
	expect(
		(await errorOf(() => parseCodexStream(codexFailure("failed to decode dialog in response body"), 1))).code,
	).toBe("failed");
});

test("codex: a JSON tail in the message is reduced to its text", async () => {
	const error = await errorOf(() =>
		parseCodexStream(codexFailure('unexpected status 400 Bad Request: {"detail":"The model is overloaded"}'), 1),
	);
	expect(error.message).toContain("The model is overloaded");
	expect(error.message).not.toMatch(/[{}]|"detail"/);
});

test("codex: a preamble followed by a failure is a failure", async () => {
	const stdout =
		line({
			type: "item.completed",
			item: { type: "agent_message", text: "I'll look up the best alternatives to HubSpot." },
		}) + codexFailure("You've hit your usage limit. Try again at 4pm.");
	expect((await errorOf(() => parseCodexStream(stdout, 1))).code).toBe("rate_limited");
});

test("codex: the answer is the final message, without the preamble", () => {
	const stdout =
		line({ type: "item.completed", item: { type: "agent_message", text: "I'll compare HubSpot and others." } }) +
		line({ type: "item.completed", item: { type: "agent_message", text: "Pipedrive is the best pick." } });
	expect(parseCodexStream(stdout, 1).text).toBe("Pipedrive is the best pick.");
});

test("a model option that looks like a flag is rejected before running", async () => {
	const codex = fakeExec({});
	const a = await errorOf(
		createCodexCli({ exec: codex.exec, model: "--dangerously-bypass-approvals-and-sandbox" }).ask("q"),
	);
	expect(a.code).toBe("failed");
	expect(codex.calls()).toBe(0);
	const claude = fakeExec({});
	await errorOf(createClaudeCli({ exec: claude.exec, model: "-x; rm" }).ask("q"));
	expect(claude.calls()).toBe(0);
});

const text = (value: string) => ({ text: value, citations: [], sources: [] });

test("a brand that is an ordinary word only matches when capitalised", () => {
	const prose =
		"Stay close to your leads and close deals faster. The notion of a CRM changes, 10 x faster; x marks the spot.";
	expect(match(text(prose), { name: "Close" }, [{ name: "Notion" }, { name: "X" }]).mentions).toEqual([]);
	const named = match(text("We use Close and Notion daily. X (formerly Twitter) too."), { name: "Close" }, [
		{ name: "Notion" },
		{ name: "X" },
	]);
	expect(named.mentions.map((m) => m.entity)).toEqual(["Close", "Notion", "X"]);
});

test("distinctive names and lower-case names stay case-insensitive", () => {
	expect(match(text("hubspot is fine"), { name: "HubSpot" }, []).brandMentioned).toBe(true);
	expect(match(text("Attio is fine"), { name: "attio" }, []).brandMentioned).toBe(true);
	expect(match(text("ATTIO is fine"), { name: "Attio" }, []).brandMentioned).toBe(true);
});

test("matching a large answer against many entities is fast", () => {
	const big = "Pipedrive and HubSpot are popular choices for agencies. ".repeat(22_000);
	const many = Array.from({ length: 500 }, (_, i) => ({ name: `Vendor${i} Suite` }));
	const started = Date.now();
	const result = match(text(big), { name: "Pipedrive" }, [{ name: "HubSpot" }, ...many]);
	expect(Date.now() - started).toBeLessThan(10_000);
	expect(result.mentions.map((m) => [m.entity, m.count])).toEqual([
		["Pipedrive", 22_000],
		["HubSpot", 22_000],
	]);
});

function result(rank: number | null, others: number): MatchResult {
	const mentions = Array.from({ length: others + (rank ? 1 : 0) }, (_, i) => ({
		entity: rank === i + 1 ? "Brand" : `O${i}`,
		rank: i + 1,
		firstIndex: i,
		count: 1,
	}));
	return {
		mentions,
		brandMentioned: rank !== null,
		brandRank: rank,
		brandCited: false,
		brandSourced: false,
		citedDomains: [],
	};
}

test("gaining a low-ranked mention never lowers the score", () => {
	for (const total of [10, 100]) {
		const base = Array.from({ length: total - 1 }, (_, i) => result(i < total / 2 ? 1 : null, 11));
		const absent = visibility(metrics([...base, result(null, 11)]));
		const twelfth = visibility(metrics([...base, result(12, 11)]));
		expect(twelfth).toBeGreaterThanOrEqual(absent);
	}
});

test("urls in adjacent markdown links are separated", () => {
	expect(extractUrls("[a](https://a.com/x),[b](https://b.com/y)")).toEqual(["https://a.com/x", "https://b.com/y"]);
});

test("a url with balanced parentheses keeps them and drops the wrapper", () => {
	expect(extractUrls("(https://en.wikipedia.org/wiki/Foo_(bar)).")).toEqual([
		"https://en.wikipedia.org/wiki/Foo_(bar)",
	]);
});

test("encoded ampersands are decoded before tracking parameters are removed", () => {
	expect(normalizeUrl("https://a.com/x?a=1&amp;b=2&amp;utm_source=openai")).toBe("https://a.com/x?a=1&b=2");
	expect(normalizeUrl("https://a.com/x?UTM_Source=y&id=2")).toBe("https://a.com/x?id=2");
});

test("unicode punctuation after a url is not part of it", () => {
	expect(extractUrls("见 https://a.com/x。 and “https://b.com/y” then https://c.com/z…")).toEqual([
		"https://a.com/x",
		"https://b.com/y",
		"https://c.com/z",
	]);
});

test("a trailing dot on the host is ignored", () => {
	expect(toDomain("https://example.com./x")).toBe("example.com");
	expect(normalizeUrl("https://example.com./x")).toBe("https://example.com/x");
});

test("normalising a url with a very long junk tail is fast", () => {
	const started = Date.now();
	expect(normalizeUrl(`https://a.com/x${"&amp;".repeat(100_000)}`)).toBe("https://a.com/x");
	expect(normalizeUrl(`https://a.com/x${".)".repeat(100_000)}`)).toBe("https://a.com/x");
	expect(Date.now() - started).toBeLessThan(500);
});

const openai = (body: unknown, status = 200) =>
	createOpenAI({
		apiKey: "k",
		model: "m",
		fetch: (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch,
	});

test("openai: an incomplete response is a failure that gives the reason", async () => {
	const error = await errorOf(
		openai({
			status: "incomplete",
			incomplete_details: { reason: "max_output_tokens" },
			output: [{ type: "message", content: [{ type: "output_text", text: "HubSpot is" }] }],
		}).ask("q"),
	);
	expect(error.code).toBe("failed");
	expect(error.message).toContain("max_output_tokens");
});

test("openai: a failed response gives the server's reason", async () => {
	const error = await errorOf(
		openai({ status: "failed", error: { code: "server_error", message: "The model crashed" }, output: [] }).ask("q"),
	);
	expect(error.message).toContain("The model crashed");
});

test("openai: a refusal gives the refusal text", async () => {
	const error = await errorOf(
		openai({
			status: "completed",
			output: [{ type: "message", content: [{ type: "refusal", refusal: "I can't help with that." }] }],
		}).ask("q"),
	);
	expect(error.code).toBe("failed");
	expect(error.message).toContain("I can't help with that.");
});

test("openai: a link written without searching is a citation but not a search source", async () => {
	const answer = await openai({
		output: [{ type: "message", content: [{ type: "output_text", text: "See https://hubspot.com/pricing" }] }],
	}).ask("q");
	expect(answer.searched).toBe(false);
	expect(answer.sources).toEqual([]);
	expect(answer.citations.map((c) => c.domain)).toEqual(["hubspot.com"]);
});

test("openai: a cancelled request says it was cancelled", async () => {
	const provider = createOpenAI({
		apiKey: "k",
		model: "m",
		fetch: ((_: unknown, init?: RequestInit) =>
			new Promise<Response>((_, reject) =>
				init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
			)) as unknown as typeof fetch,
	});
	const controller = new AbortController();
	setTimeout(() => controller.abort(), 20);
	expect((await errorOf(provider.ask("q", { signal: controller.signal }))).message).toMatch(/cancelled/i);
});
