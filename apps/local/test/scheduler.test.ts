import { expect, test } from "bun:test";
import { createRunService } from "../src/runs";
import { createScheduler } from "../src/scheduler";
import { fakeProvider, freshStore, seed } from "./helpers";

const HOUR = 3_600_000;

async function setup(schedule: string | null) {
	const store = freshStore();
	const project = seed(store, ["q"]);
	const provider = fakeProvider("claude-cli", () => "Pipedrive");
	const runs = createRunService({ store, providers: () => [provider.provider] });
	if (schedule) store.settings.set("schedule", schedule);
	const first = await runs.wait((await runs.start(project.id)).id);
	let now = first.startedAt;
	const scheduler = createScheduler({ store, runs, now: () => now });
	const tick = async (advance: number) => {
		now += advance;
		const started = await scheduler.tick();
		for (const id of started) await runs.wait(id);
		return started.length;
	};
	return { store, project, runs, tick };
}

test("nothing runs when the schedule is off or unset", async () => {
	expect(await (await setup(null)).tick(40 * 24 * HOUR)).toBe(0);
	expect(await (await setup("off")).tick(40 * 24 * HOUR)).toBe(0);
});

test("daily runs once a day has passed since the last run", async () => {
	const { tick, store, project } = await setup("daily");
	expect(await tick(23 * HOUR)).toBe(0);
	expect(await tick(2 * HOUR)).toBe(1);
	expect(store.runs.list(project.id, 10).length).toBe(2);
});

test("weekly waits a week", async () => {
	const { tick } = await setup("weekly");
	expect(await tick(6 * 24 * HOUR)).toBe(0);
	expect(await tick(25 * HOUR)).toBe(1);
});

test("a project that has never been run is not started automatically", async () => {
	const { store, tick } = await setup("daily");
	const fresh = store.projects.create({ name: "New", aliases: [], domains: [] });
	store.prompts.add(fresh.id, ["q"]);
	await tick(30 * 24 * HOUR);
	expect(store.runs.list(fresh.id, 10)).toEqual([]);
});

test("a project that cannot run does not stop the others", async () => {
	const { store, tick, runs, project } = await setup("daily");
	const empty = store.projects.create({ name: "Empty", aliases: [], domains: [] });
	store.prompts.add(empty.id, ["q"]);
	await runs.wait((await runs.start(empty.id)).id);
	for (const p of store.prompts.list(empty.id)) store.prompts.remove(p.id);
	expect(await tick(25 * HOUR)).toBe(1);
	expect(store.runs.list(project.id, 10).length).toBe(2);
});

test("a run already in progress is not doubled", async () => {
	const store = freshStore();
	const project = seed(store, ["q"]);
	const slow = fakeProvider("claude-cli", () => "x", 80);
	const runs = createRunService({ store, providers: () => [slow.provider] });
	store.settings.set("schedule", "daily");
	const first = await runs.wait((await runs.start(project.id)).id);
	let now = first.startedAt + 25 * HOUR;
	const scheduler = createScheduler({ store, runs, now: () => now });
	const started = await scheduler.tick();
	expect(started.length).toBe(1);
	now += 25 * HOUR;
	expect(await scheduler.tick()).toEqual([]);
	await runs.wait(started[0] ?? "");
});
