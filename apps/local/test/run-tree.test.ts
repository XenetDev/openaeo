import { expect, test } from "bun:test";
import { runTree, type TreeAnswer, type TreeRun } from "../web/src/screens/run-tree";

const run: TreeRun = { id: "r1", status: "done", startedAt: 1_000, finishedAt: 31_000, total: 2, completed: 2 };
const answer = (over: Partial<TreeAnswer>): TreeAnswer => ({
	id: "a1",
	engine: "claude-cli",
	promptText: "Best CRM?",
	text: "Acme.",
	searched: true,
	durationMs: 8_000,
	errorCode: null,
	errorMessage: null,
	createdAt: 11_000,
	...over,
});
const label = (id: string) => (id === "claude-cli" ? "Claude" : id);

test("each answer becomes a bar placed by when it finished and how long it took", () => {
	const tree = runTree(run, [answer({})], label);
	expect(tree.end).toBe(30_000);
	const engine = tree.children?.[0];
	expect(engine?.name).toBe("Claude");
	expect(engine?.children?.[0]).toMatchObject({
		name: "Best CRM?",
		start: 2_000,
		end: 10_000,
		status: "done",
		detail: "searched the web",
	});
});

test("a failed answer is marked failed with its reason and no output", () => {
	const call = runTree(run, [answer({ errorCode: "timeout", errorMessage: "Took too long", text: "" })], label)
		.children?.[0]?.children?.[0];
	expect(call).toMatchObject({ status: "failed", error: "Took too long" });
	expect(call?.output).toBeUndefined();
});

test("a run still going has no end, so its bars keep growing", () => {
	const tree = runTree({ ...run, status: "running", finishedAt: null }, [answer({})], label);
	expect(tree.status).toBe("running");
	expect(tree.end).toBeUndefined();
	expect(tree.children?.[0]?.end).toBeUndefined();
});

test("an answer that took longer than the run has been going starts at zero", () => {
	const call = runTree(run, [answer({ createdAt: 3_000, durationMs: 9_000 })], label).children?.[0]?.children?.[0];
	expect(call?.start).toBe(0);
});
