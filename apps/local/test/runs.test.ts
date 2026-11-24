import { expect, test } from "bun:test";
import { createRunService, RunError } from "../src/runs";
import { fakeProvider, freshStore, recordLog, seed } from "./helpers";

function codeOf(run: () => unknown) {
	try {
		run();
	} catch (error) {
		if (error instanceof RunError) return error.code;
		throw error;
	}
	return null;
}

test("a run stores one answer per prompt and engine and finishes done", async () => {
	const store = freshStore();
	const project = seed(store);
	const claude = fakeProvider("claude-cli", () => "HubSpot is the default, Pipedrive is cheaper.");
	const codex = fakeProvider("codex-cli", () => "Pipedrive first, then Attio.");
	const runs = createRunService({ store, providers: () => [claude.provider, codex.provider] });
	const started = runs.start(project.id);
	expect(started.status).toBe("running");
	expect(started.total).toBe(4);
	const finished = await runs.wait(started.id);
	expect(finished.status).toBe("done");
	expect(finished.completed).toBe(4);
	const answers = store.answers.listByRun(started.id);
	expect(answers.length).toBe(4);
	const claudeAnswer = answers.find((a) => a.engine === "claude-cli");
	expect(claudeAnswer?.brandRank).toBe(2);
	expect(claudeAnswer?.mentions.map((m) => m.entity)).toEqual(["HubSpot", "Pipedrive"]);
	expect(answers.find((a) => a.engine === "codex-cli")?.brandRank).toBe(1);
	expect(new Set(answers.map((a) => a.promptId)).size).toBe(2);
});

test("only active prompts are run", async () => {
	const store = freshStore();
	const project = seed(store);
	const [first] = store.prompts.list(project.id);
	store.prompts.setActive(first?.id ?? "", false);
	const claude = fakeProvider("claude-cli", () => "x");
	const runs = createRunService({ store, providers: () => [claude.provider] });
	const run = await runs.wait(runs.start(project.id).id);
	expect(run.total).toBe(1);
	expect(claude.calls).toEqual(["cheapest crm?"]);
});

test("a provider error is stored and the run still finishes", async () => {
	const store = freshStore();
	const project = seed(store, ["q"]);
	const broken = fakeProvider("codex-cli", () => "cli_outdated");
	const fine = fakeProvider("claude-cli", () => "Pipedrive");
	const runs = createRunService({ store, providers: () => [broken.provider, fine.provider] });
	const run = await runs.wait(runs.start(project.id).id);
	expect(run.status).toBe("done");
	const answers = store.answers.listByRun(run.id);
	expect(answers.find((a) => a.engine === "codex-cli")?.errorCode).toBe("cli_outdated");
	expect(answers.find((a) => a.engine === "claude-cli")?.errorCode).toBeNull();
});

test("start refuses when it cannot run", () => {
	const store = freshStore();
	const project = seed(store);
	const slow = fakeProvider("claude-cli", () => "x", 200);
	const runs = createRunService({ store, providers: () => [slow.provider] });
	expect(codeOf(() => runs.start("missing"))).toBe("not_found");
	const first = runs.start(project.id);
	expect(codeOf(() => runs.start(project.id))).toBe("already_running");
	runs.cancel(first.id);

	const empty = store.projects.create({ name: "Empty", aliases: [], domains: [] });
	expect(codeOf(() => runs.start(empty.id))).toBe("no_prompts");
	const none = createRunService({ store, providers: () => [] });
	const other = store.projects.create({ name: "Other", aliases: [], domains: [] });
	store.prompts.add(other.id, ["q"]);
	expect(codeOf(() => none.start(other.id))).toBe("no_engines");
});

test("cancel keeps finished answers and marks the run interrupted", async () => {
	const store = freshStore();
	const project = seed(store, ["a", "b", "c", "d"]);
	const slow = fakeProvider("claude-cli", () => "Pipedrive", 30);
	const runs = createRunService({ store, providers: () => [slow.provider], concurrency: 1 });
	const run = runs.start(project.id);
	await new Promise((resolve) => setTimeout(resolve, 45));
	runs.cancel(run.id);
	const finished = await runs.wait(run.id);
	expect(finished.status).toBe("interrupted");
	const kept = store.answers.listByRun(run.id).length;
	expect(kept).toBeGreaterThanOrEqual(1);
	expect(kept).toBeLessThan(4);
	expect(store.runs.active(project.id)).toBeNull();
	const again = runs.start(project.id);
	expect(again.status).toBe("running");
	runs.cancel(again.id);
});

test("wait on an unknown or finished run resolves", async () => {
	const store = freshStore();
	const project = seed(store, ["q"]);
	const runs = createRunService({ store, providers: () => [fakeProvider("claude-cli", () => "x").provider] });
	const run = await runs.wait(runs.start(project.id).id);
	expect((await runs.wait(run.id)).status).toBe("done");
	expect(runs.wait("missing")).rejects.toThrow();
});

test("a store failure while saving does not leave the run stuck", async () => {
	const store = freshStore();
	const project = seed(store, ["q"]);
	const { log, entries } = recordLog();
	const runs = createRunService({ store, providers: () => [fakeProvider("claude-cli", () => "x").provider], log });
	const original = store.answers.save;
	store.answers.save = () => {
		throw new Error("disk full");
	};
	const run = await runs.wait(runs.start(project.id).id);
	store.answers.save = original;
	expect(run.status).toBe("interrupted");
	expect(store.runs.active(project.id)).toBeNull();
	expect(String(entries[0]?.error)).toContain("disk full");
});
