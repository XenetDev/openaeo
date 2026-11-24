import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReport } from "../src/report";
import { createRunService, RunError } from "../src/runs";
import { openDb } from "../src/store/db";
import { createStore } from "../src/store/store";
import { fakeProvider, freshStore, seed } from "./helpers";

test("only runs whose owning process has gone are marked interrupted", () => {
	const store = freshStore();
	const project = seed(store, ["q"]);
	const mine = store.runs.create(project.id, 1);
	expect(store.runs.interruptStale()).toBe(0);
	expect(store.runs.get(mine.id)?.status).toBe("running");
	expect(store.runs.interruptStale(() => false)).toBe(1);
	expect(store.runs.get(mine.id)?.status).toBe("interrupted");
});

test("a second process cannot interrupt or duplicate a live run", async () => {
	const dir = mkdtempSync(join(tmpdir(), "openaeo-two-"));
	try {
		const path = join(dir, "openaeo.db");
		const first = createStore(openDb(path));
		const project = seed(first, ["a", "b", "c"]);
		const slowA = fakeProvider("claude-cli", () => "Pipedrive", 40);
		const runsA = createRunService({ store: first, providers: () => [slowA.provider], concurrency: 1 });
		const live = runsA.start(project.id);

		const second = createStore(openDb(path));
		expect(second.runs.interruptStale()).toBe(0);
		const fastB = fakeProvider("claude-cli", () => "Pipedrive");
		const runsB = createRunService({ store: second, providers: () => [fastB.provider] });
		let code: string | null = null;
		try {
			runsB.start(project.id);
		} catch (error) {
			code = error instanceof RunError ? error.code : "other";
		}
		expect(code).toBe("already_running");
		expect(fastB.calls.length).toBe(0);

		const finished = await runsA.wait(live.id);
		expect(finished.status).toBe("done");
		expect(slowA.calls.length).toBe(3);
		expect(first.runs.list(project.id, 10).length).toBe(1);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("two connections writing at once wait for each other", () => {
	const dir = mkdtempSync(join(tmpdir(), "openaeo-busy-"));
	try {
		const path = join(dir, "openaeo.db");
		const a = openDb(path);
		const b = openDb(path);
		expect(a.query<{ timeout: number }, []>("PRAGMA busy_timeout").get()?.timeout).toBeGreaterThanOrEqual(5000);
		expect(b.query<{ timeout: number }, []>("PRAGMA busy_timeout").get()?.timeout).toBeGreaterThanOrEqual(5000);
		a.close();
		b.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("a run that got no answers reports why", async () => {
	const store = freshStore();
	const project = seed(store, ["q1", "q2"]);
	const loggedOut = fakeProvider("claude-cli", () => "not_logged_in");
	const outdated = fakeProvider("codex-cli", () => "cli_outdated");
	const runs = createRunService({ store, providers: () => [loggedOut.provider, outdated.provider], retries: 0 });
	await runs.wait(runs.start(project.id).id);
	const report = buildReport(store, project.id);
	expect(report.overall.metrics.answers).toBe(0);
	expect(report.problems).toEqual([
		{ engine: "claude-cli", message: "claude-cli not_logged_in", count: 2 },
		{ engine: "codex-cli", message: "codex-cli cli_outdated", count: 2 },
	]);
});

test("a clean run reports no problems", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	const runs = createRunService({ store, providers: () => [fakeProvider("claude-cli", () => "Pipedrive").provider] });
	await runs.wait(runs.start(project.id).id);
	expect(buildReport(store, project.id).problems).toEqual([]);
	expect(buildReport(store, seed(freshStore()).id).problems).toEqual([]);
});

test("deleting a project during its run does not throw", async () => {
	const store = freshStore();
	const project = seed(store, ["a", "b", "c"]);
	const slow = fakeProvider("claude-cli", () => "Pipedrive", 20);
	const runs = createRunService({ store, providers: () => [slow.provider], concurrency: 1 });
	const run = runs.start(project.id);
	await new Promise((resolve) => setTimeout(resolve, 30));
	store.projects.remove(project.id);
	const finished = await runs.wait(run.id);
	expect(finished.status).toBe("interrupted");
	expect(finished.id).toBe(run.id);
});
