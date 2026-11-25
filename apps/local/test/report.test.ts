import { expect, test } from "bun:test";
import { buildReport } from "../src/report";
import { createRunService } from "../src/runs";
import { fakeProvider, freshStore, seed, src } from "./helpers";

async function runOnce(store: ReturnType<typeof freshStore>, projectId: string, claudeText: string, codexText: string) {
	const claude = fakeProvider("claude-cli", () => ({
		text: claudeText,
		citations: [src("https://blog.pipedrive.com/a"), src("https://g2.com/x")],
	}));
	const codex = fakeProvider("codex-cli", () => ({
		text: codexText,
		citations: [src("https://g2.com/y")],
		sources: [src("https://g2.com/y"), src("https://capterra.com/z")],
	}));
	const runs = createRunService({ store, providers: () => [claude.provider, codex.provider] });
	return runs.wait((await runs.start(projectId)).id);
}

test("a project with no runs reports zeros", async () => {
	const store = freshStore();
	const project = seed(store);
	const report = await buildReport(store, project.id);
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
	const report = await buildReport(store, project.id);
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
	const table = (await buildReport(store, project.id)).competitors;
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
	expect((await buildReport(store, project.id)).topDomains).toEqual([
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
	await runs.wait((await runs.start(project.id)).id);
	const report = await buildReport(store, project.id);
	expect(report.overall.metrics.answers).toBe(1);
	expect(report.engines.find((e) => e.engine === "codex-cli")).toMatchObject({ errors: 1, visibility: 0 });
});

test("the trend lists finished runs oldest first and a chosen run can be reported", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	const first = await runOnce(store, project.id, "HubSpot", "HubSpot");
	await new Promise((resolve) => setTimeout(resolve, 5));
	const second = await runOnce(store, project.id, "Pipedrive", "Pipedrive");
	const report = await buildReport(store, project.id);
	expect(report.trend.map((t) => t.runId)).toEqual([first.id, second.id]);
	expect(report.trend[0]?.mentionRate).toBe(0);
	expect(report.trend[1]?.mentionRate).toBe(1);
	expect(report.trend[1]?.visibility).toBeGreaterThan(report.trend[0]?.visibility ?? 0);
	expect((await buildReport(store, project.id, { runId: first.id })).overall.metrics.mentionRate).toBe(0);
	expect((await buildReport(store, project.id, { trendRuns: 1 })).trend.map((t) => t.runId)).toEqual([second.id]);
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
	const second = await runs.wait((await runs.start(project.id)).id);
	store.prompts.add(project.id, ["never run"]);
	const stats = await promptStats(store, project.id);
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

test("sentiment is scored from the labelled answers, overall, per engine and over time", async () => {
	const store = freshStore();
	const project = seed(store, ["q1", "q2"]);
	const run = await runOnce(store, project.id, "Pipedrive is best.", "Pipedrive is fine.");
	expect((await buildReport(store, project.id)).overall.sentiment).toEqual({
		score: null,
		positive: 0,
		neutral: 0,
		negative: 0,
	});
	const answers = store.answers.listByRun(run.id);
	const claude = answers.filter((a) => a.engine === "claude-cli");
	const codex = answers.filter((a) => a.engine === "codex-cli");
	for (const answer of claude) store.answers.setSentiment(answer.id, "positive");
	store.answers.setSentiment(codex[0]?.id as string, "neutral");
	store.answers.setSentiment(codex[1]?.id as string, "negative");

	const report = await buildReport(store, project.id);
	expect(report.overall.sentiment).toEqual({ score: 63, positive: 2, neutral: 1, negative: 1 });
	expect(report.engines.find((e) => e.engine === "claude-cli")?.sentiment.score).toBe(100);
	expect(report.engines.find((e) => e.engine === "codex-cli")?.sentiment.score).toBe(25);
	expect(report.trend.at(-1)?.sentiment).toBe(63);
});

test("a tag limits the report to the questions that carry it", async () => {
	const store = freshStore();
	const project = seed(store, ["pricing question", "other question"]);
	const [pricing] = store.prompts.list(project.id);
	store.prompts.setTags(pricing?.id as string, ["Pricing"]);
	const claude = fakeProvider("claude-cli", (prompt) =>
		prompt.includes("pricing") ? "Pipedrive is best." : "HubSpot only.",
	);
	const runs = createRunService({ store, providers: () => [claude.provider] });
	await runs.wait((await runs.start(project.id)).id);

	expect((await buildReport(store, project.id)).overall.metrics.mentionRate).toBe(0.5);
	const tagged = await buildReport(store, project.id, { tag: "pricing" });
	expect(tagged.overall.metrics.answers).toBe(1);
	expect(tagged.overall.metrics.mentionRate).toBe(1);
	expect(tagged.trend.at(-1)?.mentionRate).toBe(1);
	expect(tagged.competitors.find((c) => c.name === "HubSpot")?.mentionRate).toBe(0);
	expect((await buildReport(store, project.id, { tag: "unknown" })).overall.metrics.answers).toBe(0);
});

test("while a new run is collecting, the report keeps the last finished run's numbers", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	const first = await runOnce(store, project.id, "Pipedrive is best.", "Pipedrive too.");
	const slow = fakeProvider("claude-cli", () => "HubSpot only.", 200);
	const runs = createRunService({ store, providers: () => [slow.provider] });
	const second = await runs.start(project.id);

	const during = await buildReport(store, project.id);
	expect(during.run?.id).toBe(second.id);
	expect(during.run?.status).toBe("running");
	expect(during.basedOnRunId).toBe(first.id);
	expect(during.overall.metrics.answers).toBe(2);
	expect(during.overall.metrics.mentionRate).toBe(1);

	await runs.wait(second.id);
	const after = await buildReport(store, project.id);
	expect(after.basedOnRunId).toBe(second.id);
	expect(after.overall.metrics.mentionRate).toBe(0);
});

test("a first run shows its own answers as they arrive", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	const slow = fakeProvider("claude-cli", () => "Pipedrive.", 60);
	const runs = createRunService({ store, providers: () => [slow.provider] });
	const run = await runs.start(project.id);
	expect((await buildReport(store, project.id)).basedOnRunId).toBe(run.id);
	await runs.wait(run.id);
});

test("the trend carries every headline figure for each finished run", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	await runOnce(store, project.id, "HubSpot first, then Pipedrive.", "HubSpot only.");
	const [point] = (await buildReport(store, project.id)).trend;
	expect(point?.mentionRate).toBe(0.5);
	expect(point?.citationRate).toBe(0.5);
	expect(point?.averageRank).toBe(2);
});
