import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type MatchResult, ProviderError, type RunItem } from "@openaeo/engine";
import { openDb } from "../src/store/db";
import { createStore } from "../src/store/store";
import { freshStore, seed } from "./helpers";

const fresh = () => createStore(openDb(":memory:"));

const okItem = (prompt: string, text = "HubSpot then Pipedrive"): RunItem => ({
	prompt,
	engine: "claude-cli",
	ok: true,
	answer: {
		engine: "claude-cli",
		model: "claude-x",
		text,
		citations: [{ url: "https://pipedrive.com/pricing", domain: "pipedrive.com", title: "Pricing" }],
		sources: [
			{ url: "https://pipedrive.com/pricing", domain: "pipedrive.com", title: "Pricing" },
			{ url: "https://hubspot.com/", domain: "hubspot.com" },
		],
		searched: true,
		usage: { inputTokens: 100, outputTokens: 20, searches: 1 },
		durationMs: 1500,
	},
});

const matched: MatchResult = {
	mentions: [
		{ entity: "HubSpot", rank: 1, firstIndex: 0, count: 1 },
		{ entity: "Pipedrive", rank: 2, firstIndex: 13, count: 1 },
	],
	brandMentioned: true,
	brandRank: 2,
	brandCited: true,
	brandSourced: true,
	citedDomains: ["pipedrive.com"],
};

test("projects round-trip and update", () => {
	const store = fresh();
	const project = store.projects.create({ name: "Pipedrive", aliases: ["PD"], domains: ["pipedrive.com"] });
	expect(project.id.length).toBeGreaterThan(10);
	expect(store.projects.get(project.id)).toEqual(project);
	expect(store.projects.list()).toEqual([project]);
	const updated = store.projects.update(project.id, {
		name: "Pipedrive CRM",
		aliases: [],
		domains: ["pipedrive.com", "pipedrive.io"],
	});
	expect(updated?.name).toBe("Pipedrive CRM");
	expect(updated?.domains).toEqual(["pipedrive.com", "pipedrive.io"]);
	expect(store.projects.get("missing")).toBeNull();
	expect(store.projects.update("missing", { name: "x", aliases: [], domains: [] })).toBeNull();
});

test("a blank project name is rejected", () => {
	expect(() => fresh().projects.create({ name: "  ", aliases: [], domains: [] })).toThrow();
});

test("competitors are replaced as a set", () => {
	const store = fresh();
	const p = store.projects.create({ name: "A", aliases: [], domains: [] });
	store.competitors.replace(p.id, [
		{ name: "HubSpot", aliases: [], domains: ["hubspot.com"] },
		{ name: "Attio", aliases: ["attio.com"], domains: [] },
	]);
	expect(store.competitors.list(p.id).map((c) => c.name)).toEqual(["HubSpot", "Attio"]);
	store.competitors.replace(p.id, [
		{ name: "Zoho", aliases: [], domains: [] },
		{ name: " ", aliases: [], domains: [] },
	]);
	expect(store.competitors.list(p.id).map((c) => c.name)).toEqual(["Zoho"]);
});

test("prompts are trimmed, de-duplicated and can be paused or removed", () => {
	const store = fresh();
	const p = store.projects.create({ name: "A", aliases: [], domains: [] });
	const added = store.prompts.add(p.id, ["  best crm?  ", "Best CRM?", "", "   ", "cheapest crm"]);
	expect(added.map((x) => x.text)).toEqual(["best crm?", "cheapest crm"]);
	expect(store.prompts.add(p.id, ["BEST CRM?"])).toEqual([]);
	const [first, second] = store.prompts.list(p.id);
	expect(first?.active).toBe(true);
	store.prompts.setActive(first?.id ?? "", false);
	expect(store.prompts.list(p.id)[0]?.active).toBe(false);
	store.prompts.remove(second?.id ?? "");
	expect(store.prompts.list(p.id).length).toBe(1);
});

test("hostile text is stored literally", () => {
	const store = fresh();
	const nasty = `Rob'; DROP TABLE project;-- "q" <b>x</b> 🚀`;
	const p = store.projects.create({ name: nasty, aliases: [nasty], domains: [] });
	store.prompts.add(p.id, [nasty]);
	expect(store.projects.get(p.id)?.name).toBe(nasty);
	expect(store.projects.get(p.id)?.aliases).toEqual([nasty]);
	expect(store.prompts.list(p.id)[0]?.text).toBe(nasty);
	expect(store.projects.list().length).toBe(1);
});

test("runs track progress and finish", () => {
	const store = fresh();
	const p = store.projects.create({ name: "A", aliases: [], domains: [] });
	const run = store.runs.create(p.id, 4);
	expect(run.status).toBe("running");
	expect(run.total).toBe(4);
	expect(store.runs.active(p.id)?.id).toBe(run.id);
	store.runs.increment(run.id);
	store.runs.increment(run.id);
	expect(store.runs.get(run.id)?.completed).toBe(2);
	const done = store.runs.finish(run.id, "done");
	expect(done?.status).toBe("done");
	expect(done?.finishedAt).not.toBeNull();
	expect(store.runs.active(p.id)).toBeNull();
	expect(store.runs.latest(p.id)?.id).toBe(run.id);
	expect(store.runs.list(p.id, 10).length).toBe(1);
});

test("stale running runs are marked interrupted", () => {
	const store = fresh();
	const p = store.projects.create({ name: "A", aliases: [], domains: [] });
	const a = store.runs.create(p.id, 1);
	store.runs.finish(a.id, "done");
	const b = store.runs.create(p.id, 1);
	expect(store.runs.interruptStale(() => false)).toBe(1);
	expect(store.runs.get(b.id)?.status).toBe("interrupted");
	expect(store.runs.get(a.id)?.status).toBe("done");
	expect(store.runs.interruptStale(() => false)).toBe(0);
});

test("an answer is saved with its mentions, citations and sources", () => {
	const store = fresh();
	const p = store.projects.create({ name: "Pipedrive", aliases: [], domains: ["pipedrive.com"] });
	const [prompt] = store.prompts.add(p.id, ["best crm?"]);
	const run = store.runs.create(p.id, 1);
	const saved = store.answers.save(run.id, prompt?.id ?? "", okItem("best crm?"), matched);
	expect(saved.engine).toBe("claude-cli");
	expect(saved.model).toBe("claude-x");
	expect(saved.searched).toBe(true);
	expect(saved.inputTokens).toBe(100);
	expect(saved.searches).toBe(1);
	expect(saved.errorCode).toBeNull();
	expect(saved.brandRank).toBe(2);
	expect(saved.brandCited).toBe(true);
	expect(saved.mentions).toEqual(matched.mentions);
	expect(saved.citations).toEqual([
		{ url: "https://pipedrive.com/pricing", domain: "pipedrive.com", title: "Pricing" },
	]);
	expect(saved.sources.length).toBe(2);
	expect(saved.sources[1]).toEqual({ url: "https://hubspot.com/", domain: "hubspot.com" });
	expect(store.answers.listByRun(run.id)).toEqual([saved]);
});

test("a failed answer stores its error and no mentions", () => {
	const store = fresh();
	const p = store.projects.create({ name: "A", aliases: [], domains: [] });
	const [prompt] = store.prompts.add(p.id, ["q"]);
	const run = store.runs.create(p.id, 1);
	const item: RunItem = {
		prompt: "q",
		engine: "codex-cli",
		ok: false,
		error: new ProviderError("codex-cli", "cli_outdated", "Update Codex."),
	};
	const saved = store.answers.save(run.id, prompt?.id ?? "", item, null);
	expect(saved.errorCode).toBe("cli_outdated");
	expect(saved.errorMessage).toBe("Update Codex.");
	expect(saved.text).toBe("");
	expect(saved.mentions).toEqual([]);
	expect(saved.brandRank).toBeNull();
});

test("deleting a project removes everything under it", () => {
	const store = fresh();
	const p = store.projects.create({ name: "A", aliases: [], domains: [] });
	const other = store.projects.create({ name: "B", aliases: [], domains: [] });
	store.competitors.replace(p.id, [{ name: "C", aliases: [], domains: [] }]);
	const [prompt] = store.prompts.add(p.id, ["q"]);
	const run = store.runs.create(p.id, 1);
	store.answers.save(run.id, prompt?.id ?? "", okItem("q"), matched);
	store.projects.remove(p.id);
	expect(store.projects.list().map((x) => x.id)).toEqual([other.id]);
	expect(store.competitors.list(p.id)).toEqual([]);
	expect(store.prompts.list(p.id)).toEqual([]);
	expect(store.runs.list(p.id, 10)).toEqual([]);
	expect(store.answers.listByRun(run.id)).toEqual([]);
});

test("settings set, get and remove", () => {
	const store = fresh();
	expect(store.settings.get("schedule")).toBeNull();
	store.settings.set("schedule", "daily");
	store.settings.set("schedule", "weekly");
	expect(store.settings.get("schedule")).toBe("weekly");
	store.settings.remove("schedule");
	expect(store.settings.get("schedule")).toBeNull();
});

test("a file database keeps its data when reopened", () => {
	const dir = mkdtempSync(join(tmpdir(), "openaeo-store-"));
	try {
		const path = join(dir, "openaeo.db");
		const first = openDb(path);
		const p = createStore(first).projects.create({ name: "Kept", aliases: [], domains: [] });
		first.close();
		const second = openDb(path);
		expect(createStore(second).projects.get(p.id)?.name).toBe("Kept");
		expect(statSync(path).mode & 0o777).toBe(0o600);
		expect(second.query("PRAGMA user_version").get()).toEqual({ user_version: 8 });
		second.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("tags on a question are trimmed, de-duplicated and capped", () => {
	const store = freshStore();
	const project = seed(store, ["q"]);
	const [prompt] = store.prompts.list(project.id);
	expect(prompt?.tags).toEqual([]);
	store.prompts.setTags(prompt?.id as string, ["  Pricing ", "pricing", "", "Comparison", "x".repeat(80)]);
	expect(store.prompts.get(prompt?.id as string)?.tags).toEqual(["Pricing", "Comparison", "x".repeat(40)]);
	store.prompts.setTags(
		prompt?.id as string,
		Array.from({ length: 30 }, (_, index) => `tag ${index}`),
	);
	expect(store.prompts.get(prompt?.id as string)?.tags.length).toBe(10);
	expect(store.prompts.tags(project.id)).toContain("tag 0");
});

test("an older database gains tags on its questions without losing them", async () => {
	const { Database } = await import("bun:sqlite");
	const dir = mkdtempSync(join(tmpdir(), "openaeo-tags-"));
	try {
		const path = join(dir, "openaeo.db");
		const before = createStore(openDb(path));
		const project = seed(before, ["kept question"]);
		const raw = new Database(path);
		raw.exec(
			"ALTER TABLE project DROP COLUMN location; DROP TABLE brand_check; ALTER TABLE prompt DROP COLUMN tags; PRAGMA user_version = 5",
		);
		raw.close();
		const after = createStore(openDb(path));
		expect(after.prompts.list(project.id).map((p) => [p.text, p.tags])).toEqual([["kept question", []]]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
