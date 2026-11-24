import { expect, test } from "bun:test";
import { run, type RunItem } from "../src/run";
import { type Answer, type EngineId, type Provider, ProviderError } from "../src/types";

const answer = (engine: EngineId, text: string): Answer => ({
	engine,
	model: null,
	text,
	citations: [],
	sources: [],
	searched: false,
	usage: null,
	durationMs: 1,
});

function provider(id: EngineId, behave?: (prompt: string, attempt: number) => Promise<Answer> | Answer) {
	const calls: string[] = [];
	const attempts = new Map<string, number>();
	const p: Provider = {
		id,
		async ask(prompt) {
			calls.push(prompt);
			const attempt = (attempts.get(prompt) ?? 0) + 1;
			attempts.set(prompt, attempt);
			return behave ? behave(prompt, attempt) : answer(id, prompt);
		},
	};
	return { p, calls };
}

async function collect(gen: AsyncGenerator<RunItem>) {
	const items: RunItem[] = [];
	for await (const item of gen) items.push(item);
	return items;
}

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

test("yields every prompt and engine pair exactly once", async () => {
	const a = provider("claude-cli");
	const b = provider("codex-cli");
	const items = await collect(run({ prompts: ["p1", "p2", "p3"], providers: [a.p, b.p] }));
	expect(items.length).toBe(6);
	expect(items.map((i) => `${i.prompt}|${i.engine}`).sort()).toEqual(["p1|claude-cli", "p1|codex-cli", "p2|claude-cli", "p2|codex-cli", "p3|claude-cli", "p3|codex-cli"]);
	expect(items.every((i) => i.ok)).toBe(true);
});

test("never runs more than the concurrency limit at once", async () => {
	let inFlight = 0;
	let peak = 0;
	const slow = provider("claude-cli", async (prompt) => {
		inFlight += 1;
		peak = Math.max(peak, inFlight);
		await tick();
		inFlight -= 1;
		return answer("claude-cli", prompt);
	});
	const items = await collect(run({ prompts: ["1", "2", "3", "4", "5", "6"], providers: [slow.p], concurrency: 2 }));
	expect(items.length).toBe(6);
	expect(peak).toBe(2);
});

test("yields results as they finish, not in submission order", async () => {
	const p = provider("claude-cli", async (prompt) => {
		await tick(prompt === "slow" ? 40 : 1);
		return answer("claude-cli", prompt);
	});
	const items = await collect(run({ prompts: ["slow", "fast"], providers: [p.p], concurrency: 2 }));
	expect(items.map((i) => i.prompt)).toEqual(["fast", "slow"]);
});

test("retries a transient failure once", async () => {
	const flaky = provider("claude-cli", (prompt, attempt) => {
		if (attempt === 1) throw new ProviderError("claude-cli", "timeout", "slow");
		return answer("claude-cli", prompt);
	});
	const items = await collect(run({ prompts: ["p"], providers: [flaky.p] }));
	expect(flaky.calls.length).toBe(2);
	expect(items[0]?.ok).toBe(true);
});

test("gives up after the retry limit and reports the last error", async () => {
	const down = provider("claude-cli", () => {
		throw new ProviderError("claude-cli", "rate_limited", "limit");
	});
	const items = await collect(run({ prompts: ["p"], providers: [down.p], retries: 2 }));
	expect(down.calls.length).toBe(3);
	const item = items[0];
	expect(item?.ok).toBe(false);
	if (item && !item.ok) expect(item.error.code).toBe("rate_limited");
});

test("does not retry an error the user has to fix, and other engines continue", async () => {
	const broken = provider("codex-cli", () => {
		throw new ProviderError("codex-cli", "cli_outdated", "update codex");
	});
	const fine = provider("claude-cli");
	const items = await collect(run({ prompts: ["p1", "p2"], providers: [broken.p, fine.p] }));
	expect(broken.calls.length).toBe(2);
	expect(items.filter((i) => i.engine === "claude-cli" && i.ok).length).toBe(2);
	const failed = items.filter((i) => i.engine === "codex-cli");
	expect(failed.length).toBe(2);
	expect(failed.every((i) => !i.ok && i.error.code === "cli_outdated")).toBe(true);
});

test("wraps an unexpected throw as a failed ProviderError", async () => {
	const odd = provider("openai", () => {
		throw new TypeError("boom");
	});
	const items = await collect(run({ prompts: ["p"], providers: [odd.p], retries: 0 }));
	const item = items[0];
	expect(item?.ok).toBe(false);
	if (item && !item.ok) {
		expect(item.error).toBeInstanceOf(ProviderError);
		expect(item.error.code).toBe("failed");
		expect(item.error.engine).toBe("openai");
		expect(item.error.message).toContain("boom");
	}
});

test("aborting stops further asks", async () => {
	const controller = new AbortController();
	const p = provider("claude-cli", async (prompt) => {
		await tick();
		return answer("claude-cli", prompt);
	});
	const seen: RunItem[] = [];
	for await (const item of run({ prompts: ["1", "2", "3", "4", "5"], providers: [p.p], concurrency: 1, signal: controller.signal })) {
		seen.push(item);
		controller.abort();
	}
	expect(seen.length).toBe(1);
	expect(p.calls.length).toBe(1);
});

test("stopping iteration early stops further asks", async () => {
	const p = provider("claude-cli", async (prompt) => {
		await tick();
		return answer("claude-cli", prompt);
	});
	for await (const _ of run({ prompts: ["1", "2", "3", "4"], providers: [p.p], concurrency: 1 })) break;
	await tick(30);
	expect(p.calls.length).toBe(1);
});

test("passes the timeout and a signal to each ask", async () => {
	const seen: { timeoutMs?: number; hasSignal: boolean }[] = [];
	const p: Provider = {
		id: "claude-cli",
		async ask(prompt, opts) {
			seen.push({ timeoutMs: opts?.timeoutMs, hasSignal: opts?.signal instanceof AbortSignal });
			return answer("claude-cli", prompt);
		},
	};
	await collect(run({ prompts: ["p"], providers: [p], timeoutMs: 7000 }));
	expect(seen).toEqual([{ timeoutMs: 7000, hasSignal: true }]);
});

test("no prompts or no providers yields nothing", async () => {
	expect(await collect(run({ prompts: [], providers: [provider("claude-cli").p] }))).toEqual([]);
	expect(await collect(run({ prompts: ["p"], providers: [] }))).toEqual([]);
});

test("a concurrency below one is treated as one", async () => {
	const p = provider("claude-cli");
	expect((await collect(run({ prompts: ["a", "b"], providers: [p.p], concurrency: 0 }))).length).toBe(2);
});
