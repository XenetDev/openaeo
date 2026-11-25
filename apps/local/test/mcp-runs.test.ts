import { expect, test } from "bun:test";
import { expectQuoted, mcp } from "./mcp-helpers";

test("list_runs shows each run with its status, answers, engines and errors", async () => {
	const { call, finishRun } = await mcp({
		answer: (question) => (question.includes("best") ? "rate_limited" : "Pipedrive is the cheapest, then HubSpot."),
	});
	const none = await call("list_runs");
	expect(none.isError).toBe(false);
	expect(none.text).toMatch(/no runs yet/i);

	const run = await finishRun();
	await finishRun();
	const out = await call("list_runs");
	expect(out.text).toMatch(/2 runs for Pipedrive, newest first/);
	expect(out.text).toMatch(/\d{4}-\d\d-\d\d \d\d:\d\d UTC · done · 2 of 2 answers, 1 failed/);
	expect(out.text).toContain("engines: Claude");
	expect(out.text).toMatch(/visibility \d+/);
	expect(out.text).toContain(`id ${run.id}`);
	expectQuoted(out.text, "claude-cli rate_limited");

	const one = await call("list_runs", { limit: 1 });
	expect(one.text.match(/^ {4}id /gm)?.length).toBe(1);
	expect((await call("list_answers", { run: run.id })).text).toContain("cheapest crm?");
});

test("cancel_run stops the run in progress and keeps the answers collected so far", async () => {
	const { call, store, project } = await mcp({ delay: 500 });
	await call("run_prompts");
	const running = await call("list_runs");
	expect(running.text).toContain("running");
	expect(running.text).toContain("cancel_run");

	const out = await call("cancel_run");
	expect(out.isError).toBe(false);
	expect(out.text).toMatch(/stopped the run/i);
	expect(store.runs.latest(project.id)?.status).toBe("interrupted");
	expect((await call("list_runs")).text).toContain("stopped early");
});

test("cancel_run says so when no run is in progress", async () => {
	const { call, finishRun } = await mcp();
	const never = await call("cancel_run");
	expect(never.isError).toBe(true);
	expect(never.text).toMatch(/no run is in progress/i);
	await finishRun();
	expect((await call("cancel_run")).isError).toBe(true);
});

test("cancel_run is honest about a run this server cannot reach", async () => {
	const { call, store, project } = await mcp();
	store.runs.create(project.id, 4);
	const out = await call("cancel_run");
	expect(out.isError).toBe(true);
	expect(out.text).toMatch(/still marked as running/i);
});

test("get_schedule and set_schedule read and change when runs start on their own", async () => {
	const { call, store, finishRun, tool } = await mcp();
	expect((await call("get_schedule")).text).toMatch(/Automatic runs: off/);
	expect((await call("get_schedule")).text).toContain("off, daily, weekly");
	expect((await tool("get_schedule"))?.annotations?.readOnlyHint).toBe(true);
	expect((await tool("set_schedule"))?.annotations?.readOnlyHint).toBe(false);

	await finishRun();
	const set = await call("set_schedule", { schedule: "Weekly" });
	expect(set.isError).toBe(false);
	expect(store.settings.get("schedule")).toBe("weekly");
	const now = await call("get_schedule");
	expect(now.text).toMatch(/Automatic runs: once a week/);
	expect(now.text).toMatch(/Pipedrive: next run about \d{4}-\d\d-\d\d/);
	expect(now.text).toContain("while OpenAEO is open");

	await call("set_schedule", { schedule: "off" });
	expect(store.settings.get("schedule")).toBe("off");
});

test("set_schedule refuses a value the host does not allow and lists the ones it does", async () => {
	const local = await mcp();
	const hourly = await local.call("set_schedule", { schedule: "hourly" });
	expect(hourly.isError).toBe(true);
	expect(hourly.text).toContain("off, daily, weekly");
	expect(local.store.settings.get("schedule")).toBeNull();

	const host = await mcp({ deps: { schedules: ["off", "weekly"], words: { schedule: "Runs happen on the host." } } });
	const daily = await host.call("set_schedule", { schedule: "daily" });
	expect(daily.isError).toBe(true);
	expect(daily.text).toContain("off, weekly");
	expect(daily.text).not.toContain("daily,");
	expect((await host.call("set_schedule", { schedule: "weekly" })).isError).toBe(false);
	expect((await host.call("get_schedule")).text).toContain("Runs happen on the host.");
});
