import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, runOnce } from "../src/cli";
import { dataDir } from "../src/paths";
import { createRunService } from "../src/runs";
import { fakeProvider, freshStore, seed } from "./helpers";

test("no arguments starts the dashboard and opens the browser", () => {
	expect(parseArgs([])).toEqual({ command: "serve", open: true, json: false });
	expect(parseArgs(["--no-open"])).toEqual({ command: "serve", open: false, json: false });
	expect(parseArgs(["--port", "5000"])).toEqual({ command: "serve", open: true, json: false, port: 5000 });
});

test("run, status, version and help are parsed", () => {
	expect(parseArgs(["run"])).toEqual({ command: "run", open: true, json: false });
	expect(parseArgs(["run", "--project", "Pipedrive", "--json"])).toEqual({
		command: "run",
		open: true,
		json: true,
		project: "Pipedrive",
	});
	expect(parseArgs(["status"]).command).toBe("status");
	expect(parseArgs(["--version"]).command).toBe("version");
	expect(parseArgs(["-v"]).command).toBe("version");
	expect(parseArgs(["--help"]).command).toBe("help");
	expect(parseArgs(["help"]).command).toBe("help");
});

test("unknown commands and flags are errors that name the problem", () => {
	expect(parseArgs(["frobnicate"])).toEqual({
		command: "error",
		message: 'Unknown command "frobnicate". Run `openaeo --help`.',
	});
	expect(parseArgs(["run", "--wat"])).toEqual({
		command: "error",
		message: 'Unknown option "--wat". Run `openaeo --help`.',
	});
	expect(parseArgs(["run", "--project"]).command).toBe("error");
	expect(parseArgs(["--port", "abc"]).command).toBe("error");
	expect(parseArgs(["--port", "70000"]).command).toBe("error");
});

function setup(reply: () => string) {
	const store = freshStore();
	const project = seed(store, ["best crm?"]);
	const claude = fakeProvider("claude-cli", reply);
	const runs = createRunService({ store, providers: () => [claude.provider], retries: 0 });
	const lines: string[] = [];
	return { store, project, runs, lines, out: (line: string) => lines.push(line) };
}

test("run prints a report and succeeds", async () => {
	const { store, runs, lines, out } = setup(() => "Pipedrive is best, then HubSpot.");
	const code = await runOnce({ store, runs, out, json: false });
	expect(code).toBe(0);
	const text = lines.join("\n");
	expect(text).toContain("Pipedrive");
	expect(text).toMatch(/Visibility\s+\d/);
	expect(text).toContain("Claude");
	expect(text).toMatch(/Mentioned in\s+100%/);
});

test("run --json prints the report as JSON only", async () => {
	const { store, runs, lines, out } = setup(() => "Pipedrive");
	expect(await runOnce({ store, runs, out, json: true })).toBe(0);
	const report = JSON.parse(lines.join("\n"));
	expect(report.overall.metrics.mentionRate).toBe(1);
});

test("run fails when every answer failed, and says why", async () => {
	const { store, runs, lines, out } = setup(() => "not_logged_in");
	expect(await runOnce({ store, runs, out, json: false })).toBe(1);
	expect(lines.join("\n")).toContain("claude-cli not_logged_in");
});

test("run needs an existing project", async () => {
	const store = freshStore();
	const runs = createRunService({ store, providers: () => [] });
	const lines: string[] = [];
	expect(await runOnce({ store, runs, out: (l) => lines.push(l), json: false })).toBe(1);
	expect(lines.join("\n")).toMatch(/no project/i);
	const seeded = setup(() => "x");
	expect(await runOnce({ store: seeded.store, runs: seeded.runs, out: seeded.out, json: false, project: "Nope" })).toBe(
		1,
	);
	expect(seeded.lines.join("\n")).toContain('"Nope"');
});

test("run reports a start problem instead of crashing", async () => {
	const store = freshStore();
	seed(store, ["q"]);
	const runs = createRunService({ store, providers: () => [] });
	const lines: string[] = [];
	expect(await runOnce({ store, runs, out: (l) => lines.push(l), json: false })).toBe(1);
	expect(lines.join("\n")).toMatch(/No AI engine is available/);
});

test("the data directory honours OPENAEO_HOME and is private", () => {
	const base = mkdtempSync(join(tmpdir(), "openaeo-paths-"));
	try {
		const dir = dataDir({ OPENAEO_HOME: join(base, "nested", "home") });
		expect(dir).toBe(join(base, "nested", "home"));
		expect(statSync(dir).mode & 0o777).toBe(0o700);
		expect(dataDir({ OPENAEO_HOME: dir })).toBe(dir);
		expect(dataDir({ HOME: base })).toBe(join(base, ".openaeo"));
	} finally {
		rmSync(base, { recursive: true, force: true });
	}
});

test("the printed report includes sentiment once answers are labelled", async () => {
	const { formatReport } = await import("../src/format");
	const { buildReport } = await import("../src/report");
	const { createRunService } = await import("../src/runs");
	const { fakeProvider, freshStore, seed } = await import("./helpers");
	const store = freshStore();
	const project = seed(store, ["q1", "q2"]);
	const runs = createRunService({ store, providers: () => [fakeProvider("claude-cli", () => "Pipedrive").provider] });
	const run = await runs.wait((await runs.start(project.id)).id);
	expect(formatReport("Pipedrive", await buildReport(store, project.id))).not.toContain("Sentiment");
	const [first, second] = store.answers.listByRun(run.id);
	store.answers.setSentiment(first?.id as string, "positive");
	store.answers.setSentiment(second?.id as string, "negative");
	expect(formatReport("Pipedrive", await buildReport(store, project.id))).toContain(
		"Sentiment         50 / 100 (1 positive, 0 neutral, 1 negative)",
	);
});
