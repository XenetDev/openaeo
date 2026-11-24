import { expect, test } from "bun:test";
import { createRunService } from "../src/runs";
import { labelSentiment, parseSentiment } from "../src/sentiment";
import { fakeProvider, freshStore, recordLog, seed } from "./helpers";

test("labels come back keyed by answer", async () => {
	const p = fakeProvider("claude-cli", () => '{"1": "positive", "2": "negative"}');
	const labels = await labelSentiment(p.provider, "Pipedrive", [
		{ id: "a", text: "Pipedrive is excellent for small teams." },
		{ id: "b", text: "Avoid Pipedrive; support is slow." },
	]);
	expect(labels).toEqual(
		new Map([
			["a", "positive"],
			["b", "negative"],
		]),
	);
	expect(p.calls.length).toBe(1);
	expect(p.calls[0]).toContain("Pipedrive is excellent");
	expect(p.calls[0]).toContain("support is slow");
});

test("the reply is parsed leniently and unknown labels are dropped", () => {
	expect(parseSentiment('Sure!\n```json\n{"1":"Positive","2":"mixed","3":"NEUTRAL","9":"negative"}\n```', 3)).toEqual(
		new Map([
			[1, "positive"],
			[3, "neutral"],
		]),
	);
	expect(parseSentiment("1: positive\n2 - negative", 2)).toEqual(
		new Map([
			[1, "positive"],
			[2, "negative"],
		]),
	);
	expect(parseSentiment("no idea", 2)).toEqual(new Map());
	expect(parseSentiment("[1,2,3]", 2)).toEqual(new Map());
});

test("only the parts of a long answer near the brand are sent", async () => {
	const p = fakeProvider("claude-cli", () => '{"1":"neutral"}');
	const filler = "Unrelated filler sentence about other things. ".repeat(400);
	await labelSentiment(p.provider, "Pipedrive", [{ id: "a", text: `${filler}Pipedrive is decent value. ${filler}` }]);
	expect(p.calls[0]?.length).toBeLessThan(3000);
	expect(p.calls[0]).toContain("Pipedrive is decent value");
});

test("no answers means no call, and a failing engine gives no labels", async () => {
	const p = fakeProvider("claude-cli", () => "{}");
	expect(await labelSentiment(p.provider, "X", [])).toEqual(new Map());
	expect(p.calls.length).toBe(0);
	const broken = fakeProvider("claude-cli", () => "rate_limited");
	const { log, entries } = recordLog();
	expect(await labelSentiment(broken.provider, "X", [{ id: "a", text: "X is fine" }], { log })).toEqual(new Map());
	expect(entries.map((entry) => entry.context)).toEqual(["labelling sentiment"]);
});

test("a run stores sentiment for answers that mention the brand", async () => {
	const store = freshStore();
	const project = seed(store, ["q1", "q2"]);
	const asked: string[] = [];
	const provider = fakeProvider("claude-cli", (prompt) => {
		asked.push(prompt);
		if (prompt.includes("Classify")) return '{"1":"positive"}';
		return prompt === "q1" ? "Pipedrive is great." : "HubSpot only.";
	});
	const runs = createRunService({ store, providers: () => [provider.provider], sentiment: true });
	const run = await runs.wait(runs.start(project.id).id);
	expect(run.status).toBe("done");
	const answers = store.answers.listByRun(run.id);
	expect(answers.find((a) => a.brandRank !== null)?.sentiment).toBe("positive");
	expect(answers.find((a) => a.brandRank === null)?.sentiment).toBeNull();
	expect(asked.filter((p) => p.includes("Classify")).length).toBe(1);
});

test("a sentiment failure does not fail the run", async () => {
	const store = freshStore();
	const project = seed(store, ["q1"]);
	const provider = fakeProvider("claude-cli", (prompt) =>
		prompt.includes("Classify") ? "rate_limited" : "Pipedrive is great.",
	);
	const runs = createRunService({
		store,
		providers: () => [provider.provider],
		sentiment: true,
		retries: 0,
		log: recordLog().log,
	});
	const run = await runs.wait(runs.start(project.id).id);
	expect(run.status).toBe("done");
	expect(store.answers.listByRun(run.id)[0]?.sentiment).toBeNull();
});

test("an existing database gains the sentiment column", async () => {
	const { Database } = await import("bun:sqlite");
	const { mkdtempSync, rmSync } = await import("node:fs");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const { openDb } = await import("../src/store/db");
	const dir = mkdtempSync(join(tmpdir(), "openaeo-mig-"));
	try {
		const path = join(dir, "openaeo.db");
		openDb(path).close();
		const raw = new Database(path);
		raw.exec(
			"ALTER TABLE project DROP COLUMN location; ALTER TABLE answer DROP COLUMN sentiment; ALTER TABLE run DROP COLUMN owner_pid; DROP TABLE brand_check; ALTER TABLE prompt DROP COLUMN tags; DROP TABLE finding; DROP TABLE audit; PRAGMA user_version = 1",
		);
		raw.close();
		const db = openDb(path);
		const columns = db
			.query<{ name: string }, []>("PRAGMA table_info(answer)")
			.all()
			.map((c) => c.name);
		expect(columns).toContain("sentiment");
		expect(
			db
				.query<{ name: string }, []>("PRAGMA table_info(run)")
				.all()
				.map((c) => c.name),
		).toContain("owner_pid");
		db.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
