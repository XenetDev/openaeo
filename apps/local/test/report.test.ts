import { expect, test } from "bun:test";
import { buildReport } from "../src/report";
import { createRunService } from "../src/runs";
import { fakeProvider, freshStore, seed, src } from "./helpers";

async function runOnce(store: ReturnType<typeof freshStore>, projectId: string, claudeText: string, codexText: string) {
	const claude = fakeProvider("claude-cli", () => ({ text: claudeText, citations: [src("https://blog.pipedrive.com/a"), src("https://g2.com/x")] }));
	const codex = fakeProvider("codex-cli", () => ({ text: codexText, citations: [src("https://g2.com/y")], sources: [src("https://g2.com/y"), src("https://capterra.com/z")] }));
	const runs = createRunService({ store, providers: () => [claude.provider, codex.provider] });
	return runs.wait(runs.start(projectId).id);
}

test("a project with no runs reports zeros", () => {
	const store = freshStore();
	const project = seed(store);
	const report = buildReport(store, project.id);
	expect(report.run).toBeNull();
	expect(report.overall.visibility).toBe(0);
	expect(report.overall.metrics.answers).toBe(0);
	expect(report.engines).toEqual([]);
	expect(report.topDomains).toEqual([]);
	expect(report.trend).toEqual([]);
	expect(report.competitors.map((c) => c.name)).toEqual(["Pipedrive", "HubSpot", "Attio"]);
});

test("the report summarises the latest run overall and per engine", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	const run = await runOnce(store, project.id, "Pipedrive is best. HubSpot is second.", "HubSpot only.");
	const report = buildReport(store, project.id);
	expect(report.run?.id).toBe(run.id);
	expect(report.overall.metrics.answers).toBe(2);
	expect(report.overall.metrics.mentionRate).toBe(0.5);
	expect(report.overall.metrics.citationRate).toBe(0.5);
	const claude = report.engines.find((e) => e.engine === "claude-cli");
	const codex = report.engines.find((e) => e.engine === "codex-cli");
	expect(claude?.metrics.mentionRate).toBe(1);
	expect(claude?.metrics.averageRank).toBe(1);
	expect(claude?.visibility).toBeGreaterThan(codex?.visibility ?? 0);
	expect(codex?.metrics.mentionRate).toBe(0);
	expect(codex?.errors).toBe(0);
});

test("the competitor table ranks everyone by how often they are mentioned", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	await runOnce(store, project.id, "Pipedrive is best. HubSpot is second.", "HubSpot only.");
	const table = buildReport(store, project.id).competitors;
	expect(table.map((c) => [c.name, c.mentionRate, c.averageRank, c.isBrand])).toEqual([
		["HubSpot", 1, 1.5, false],
		["Pipedrive", 0.5, 1, true],
		["Attio", 0, null, false],
	]);
});

test("top domains count citations and flag the brand's own site", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	await runOnce(store, project.id, "Pipedrive", "HubSpot");
	expect(buildReport(store, project.id).topDomains).toEqual([
		{ domain: "g2.com", citations: 2, isBrand: false },
		{ domain: "blog.pipedrive.com", citations: 1, isBrand: true },
	]);
});

test("failed answers count as errors and not as answers", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	const broken = fakeProvider("codex-cli", () => "rate_limited");
	const fine = fakeProvider("claude-cli", () => "Pipedrive");
	const runs = createRunService({ store, providers: () => [broken.provider, fine.provider], retries: 0 });
	await runs.wait(runs.start(project.id).id);
	const report = buildReport(store, project.id);
	expect(report.overall.metrics.answers).toBe(1);
	expect(report.engines.find((e) => e.engine === "codex-cli")).toMatchObject({ errors: 1, visibility: 0 });
});

test("the trend lists finished runs oldest first and a chosen run can be reported", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	const first = await runOnce(store, project.id, "HubSpot", "HubSpot");
	await new Promise((resolve) => setTimeout(resolve, 5));
	const second = await runOnce(store, project.id, "Pipedrive", "Pipedrive");
	const report = buildReport(store, project.id);
	expect(report.trend.map((t) => t.runId)).toEqual([first.id, second.id]);
	expect(report.trend[0]?.mentionRate).toBe(0);
	expect(report.trend[1]?.mentionRate).toBe(1);
	expect(report.trend[1]?.visibility).toBeGreaterThan(report.trend[0]?.visibility ?? 0);
	expect(buildReport(store, project.id, { runId: first.id }).overall.metrics.mentionRate).toBe(0);
	expect(buildReport(store, project.id, { trendRuns: 1 }).trend.map((t) => t.runId)).toEqual([second.id]);
});

test("prompt stats give each question's mention rate per run, oldest first", async () => {
	const { promptStats } = await import("../src/report");
	const store = freshStore();
	const project = seed(store, ["q1", "q2"]);
	const first = await runOnce(store, project.id, "HubSpot", "HubSpot");
	await new Promise((resolve) => setTimeout(resolve, 5));
	const claude = fakeProvider("claude-cli", (prompt) => (prompt === "q1" ? "Pipedrive wins" : "HubSpot"));
	const codex = fakeProvider("codex-cli", (prompt) => (prompt === "q1" ? "HubSpot then Pipedrive" : "rate_limited"));
	const runs = createRunService({ store, providers: () => [claude.provider, codex.provider], retries: 0 });
	const second = await runs.wait(runs.start(project.id).id);
	store.prompts.add(project.id, ["never run"]);
	const stats = promptStats(store, project.id);
	expect(stats.map((s) => s.text)).toEqual(["q1", "q2", "never run"]);
	expect(stats[0]?.history.map((h) => [h.runId, h.rate])).toEqual([
		[first.id, 0],
		[second.id, 1],
	]);
	expect(stats[0]).toMatchObject({ latest: 1, previous: 0, bestRank: 1, active: true });
	expect(stats[1]).toMatchObject({ latest: 0, previous: 0, bestRank: null });
	expect(stats[1]?.history.length).toBe(2);
	expect(stats[2]).toMatchObject({ latest: null, previous: null, bestRank: null, history: [] });
});
