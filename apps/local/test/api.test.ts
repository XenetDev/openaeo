import { expect, test } from "bun:test";
import type { EngineStatus } from "../src/engine-catalog";
import type { Log } from "../src/log";
import { createRunService } from "../src/runs";
import { createHandler } from "../src/server/handler";
import { fakeProvider, freshStore, recordLog } from "./helpers";

const TOKEN = "test-token";
const PORT = 4747;

function setup(opts: { delayMs?: number; log?: Log } = {}) {
	const store = freshStore();
	const claude = fakeProvider("claude-cli", () => "Pipedrive is best, HubSpot second.", opts.delayMs ?? 0);
	const runs = createRunService({ store, providers: () => [claude.provider] });
	const engines = (): EngineStatus[] => [
		{ id: "claude-cli", label: "Claude", available: true, reason: null, enabled: true, api: null },
	];
	const assets = (path: string) =>
		path === "/index.html"
			? new Response("<html><head></head><body>app</body></html>", { headers: { "content-type": "text/html" } })
			: null;
	const handler = createHandler({
		store,
		runs,
		engines,
		token: TOKEN,
		port: PORT,
		assets,
		log: opts.log,
		suggest: async (context) => ({
			prompts: [`Best alternative to ${context.competitors[0] ?? context.brand}?`],
			fallback: false,
		}),
	});
	const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
		const response = await handler(
			new Request(`http://127.0.0.1:${PORT}${path}`, {
				method,
				headers: {
					host: `127.0.0.1:${PORT}`,
					"x-openaeo-token": TOKEN,
					...(body === undefined ? {} : { "content-type": "application/json" }),
					...headers,
				},
				body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
			}),
		);
		const text = await response.text();
		let json: unknown = null;
		try {
			json = JSON.parse(text);
		} catch {}
		return { status: response.status, json: json as Record<string, any>, text, headers: response.headers };
	};
	return { store, runs, call, handler };
}

async function project(call: ReturnType<typeof setup>["call"]) {
	const created = await call("POST", "/api/projects", {
		name: "Pipedrive",
		aliases: [],
		domains: ["pipedrive.com"],
		competitors: [{ name: "HubSpot", aliases: [], domains: [] }],
		prompts: ["best crm?", "cheapest crm?"],
	});
	return created.json.project.id as string;
}

test("the whole flow: create a project, run it, read the report", async () => {
	const { call, runs } = setup();
	const created = await call("POST", "/api/projects", {
		name: "Pipedrive",
		aliases: [],
		domains: ["pipedrive.com"],
		competitors: [{ name: "HubSpot", aliases: [], domains: [] }],
		prompts: ["best crm?"],
	});
	expect(created.status).toBe(201);
	const id = created.json.project.id as string;

	const state = await call("GET", "/api/state");
	expect(state.status).toBe(200);
	expect(state.json.projects.map((p: { id: string }) => p.id)).toEqual([id]);
	expect(state.json.engines[0].label).toBe("Claude");

	const added = await call("POST", `/api/projects/${id}/prompts`, { texts: ["cheapest crm?", "best crm?"] });
	expect(added.status).toBe(201);
	expect(added.json.prompts.length).toBe(2);

	const started = await call("POST", `/api/projects/${id}/runs`);
	expect(started.status).toBe(202);
	await runs.wait(started.json.run.id);

	const run = await call("GET", `/api/runs/${started.json.run.id}`);
	expect(run.json.run.status).toBe("done");
	expect(run.json.answers.length).toBe(2);
	expect(run.json.answers[0].promptText).toBeDefined();

	const report = await call("GET", `/api/projects/${id}/report`);
	expect(report.status).toBe(200);
	expect(report.json.overall.metrics.mentionRate).toBe(1);
	expect(report.json.competitors.map((c: { name: string }) => c.name)).toEqual(["Pipedrive", "HubSpot"]);

	const list = await call("GET", `/api/projects/${id}/runs`);
	expect(list.json.runs.length).toBe(1);
});

test("requests without the right token, host or origin are refused before any work", async () => {
	const { call, store } = setup();
	const body = { name: "X", aliases: [], domains: [], competitors: [], prompts: [] };
	expect((await call("POST", "/api/projects", body, { "x-openaeo-token": "" })).status).toBe(403);
	expect((await call("POST", "/api/projects", body, { "x-openaeo-token": "wrong" })).status).toBe(403);
	expect((await call("POST", "/api/projects", body, { host: "evil.example" })).status).toBe(403);
	expect((await call("POST", "/api/projects", body, { host: `127.0.0.1:${PORT + 1}` })).status).toBe(403);
	expect((await call("POST", "/api/projects", body, { origin: "https://evil.example" })).status).toBe(403);
	expect((await call("GET", "/api/state", undefined, { host: "evil.example" })).status).toBe(403);
	expect(store.projects.list()).toEqual([]);
	expect(
		(await call("POST", "/api/projects", body, { host: `localhost:${PORT}`, origin: `http://localhost:${PORT}` }))
			.status,
	).toBe(201);
});

test("the page itself is refused for a foreign host", async () => {
	const { call } = setup();
	expect((await call("GET", "/", undefined, { host: "evil.example", "x-openaeo-token": "" })).status).toBe(403);
});

test("invalid bodies get a 400 that names the problem", async () => {
	const { call } = setup();
	const missing = await call("POST", "/api/projects", { aliases: [] });
	expect(missing.status).toBe(400);
	expect(missing.json.error).toMatch(/name/i);
	expect((await call("POST", "/api/projects", "not json")).status).toBe(400);
	expect(
		(await call("POST", "/api/projects", { name: "   ", aliases: [], domains: [], competitors: [], prompts: [] }))
			.status,
	).toBe(400);
	const id = await project(call);
	expect((await call("POST", `/api/projects/${id}/prompts`, { texts: "nope" })).status).toBe(400);
});

test("unknown ids and unknown api paths are 404 JSON", async () => {
	const { call } = setup();
	for (const [method, path] of [
		["GET", "/api/projects/missing/report"],
		["PATCH", "/api/projects/missing"],
		["POST", "/api/projects/missing/runs"],
		["GET", "/api/runs/missing"],
		["DELETE", "/api/prompts/missing"],
		["GET", "/api/nope"],
	] as const) {
		const response = await call(method, path, method === "PATCH" ? { name: "x", aliases: [], domains: [] } : undefined);
		expect(response.status).toBe(404);
		expect(typeof response.json.error).toBe("string");
	}
});

test("a second run for the same project is a 409", async () => {
	const { call, runs } = setup({ delayMs: 100 });
	const id = await project(call);
	const first = await call("POST", `/api/projects/${id}/runs`);
	expect(first.status).toBe(202);
	const second = await call("POST", `/api/projects/${id}/runs`);
	expect(second.status).toBe(409);
	expect(second.json.error).toMatch(/already/i);
	const cancelled = await call("POST", `/api/runs/${first.json.run.id}/cancel`);
	expect(cancelled.status).toBe(200);
	expect((await runs.wait(first.json.run.id)).status).toBe("interrupted");
});

test("a run with no prompts is a 400 that says what to do", async () => {
	const { call } = setup();
	const created = await call("POST", "/api/projects", {
		name: "Empty",
		aliases: [],
		domains: [],
		competitors: [],
		prompts: [],
	});
	const response = await call("POST", `/api/projects/${created.json.project.id}/runs`);
	expect(response.status).toBe(400);
	expect(response.json.error).toMatch(/prompt/i);
});

test("projects, competitors and prompts can be edited and removed", async () => {
	const { call } = setup();
	const id = await project(call);
	const patched = await call("PATCH", `/api/projects/${id}`, {
		name: "Pipedrive CRM",
		aliases: ["PD"],
		domains: ["pipedrive.com"],
	});
	expect(patched.json.project.name).toBe("Pipedrive CRM");
	const competitors = await call("PUT", `/api/projects/${id}/competitors`, {
		competitors: [{ name: "Attio", aliases: [], domains: [] }],
	});
	expect(competitors.json.competitors.map((c: { name: string }) => c.name)).toEqual(["Attio"]);
	const prompts = await call("GET", `/api/projects/${id}/prompts`);
	const promptId = prompts.json.prompts[0].id as string;
	expect((await call("PATCH", `/api/prompts/${promptId}`, { active: false })).json.prompt.active).toBe(false);
	expect((await call("DELETE", `/api/prompts/${promptId}`)).status).toBe(200);
	expect((await call("GET", `/api/projects/${id}/prompts`)).json.prompts.length).toBe(1);
	expect((await call("DELETE", `/api/projects/${id}`)).status).toBe(200);
	expect((await call("GET", "/api/state")).json.projects).toEqual([]);
});

test("settings never return a full API key", async () => {
	const { call, store } = setup();
	const saved = await call("PUT", "/api/settings", {
		"openai.apiKey": "sk-abcdefghijklmnop1234",
		"openai.model": "gpt-x",
		schedule: "daily",
	});
	expect(saved.status).toBe(200);
	expect(store.settings.get("openai.apiKey")).toBe("sk-abcdefghijklmnop1234");
	const read = await call("GET", "/api/settings");
	expect(read.text).not.toContain("sk-abcdefghijklmnop1234");
	expect(read.json.settings["openai.apiKey"]).toBe("••••1234");
	expect(read.json.settings["openai.model"]).toBe("gpt-x");
	await call("PUT", "/api/settings", { "openai.apiKey": "••••1234", "openai.model": "gpt-y" });
	expect(store.settings.get("openai.apiKey")).toBe("sk-abcdefghijklmnop1234");
	await call("PUT", "/api/settings", { "openai.apiKey": "" });
	expect(store.settings.get("openai.apiKey")).toBeNull();
	expect((await call("PUT", "/api/settings", { "not.allowed": "x" })).status).toBe(400);
	expect((await call("PUT", "/api/settings", { schedule: "hourly" })).status).toBe(400);
});

test("non-api paths serve the app with the token and safe headers", async () => {
	const { call } = setup();
	for (const path of ["/", "/prompts", "/answers/123"]) {
		const page = await call("GET", path, undefined, { "x-openaeo-token": "" });
		expect(page.status).toBe(200);
		expect(page.text).toContain(`<meta name="openaeo-token" content="${TOKEN}">`);
		expect(page.headers.get("cache-control")).toBe("no-store");
		expect(page.headers.get("x-frame-options")).toBe("DENY");
	}
});

test("an unexpected error is logged and answered as a 500 without internals", async () => {
	const { log, entries } = recordLog();
	const { call, store } = setup({ log });
	store.projects.list = () => {
		throw new Error("SQLITE_CORRUPT: secret path /Users/x");
	};
	const response = await call("GET", "/api/state");
	expect(response.status).toBe(500);
	expect(response.text).not.toContain("SQLITE_CORRUPT");
	expect(entries.map((entry) => entry.context)).toEqual(["GET /api/state"]);
	expect(String(entries[0]?.error)).toContain("SQLITE_CORRUPT");
});

test("suggestions are offered for a project without being saved", async () => {
	const { call } = setup();
	const id = await project(call);
	const response = await call("POST", `/api/projects/${id}/suggestions`);
	expect(response.status).toBe(200);
	expect(response.json.prompts).toEqual(["Best alternative to HubSpot?"]);
	expect(response.json.fallback).toBe(false);
	expect((await call("GET", `/api/projects/${id}/prompts`)).json.prompts.length).toBe(2);
	expect((await call("POST", "/api/projects/missing/suggestions")).status).toBe(404);
});

test("answers carry their sentiment", async () => {
	const { call, runs, store } = setup();
	const id = await project(call);
	const started = await call("POST", `/api/projects/${id}/runs`);
	await runs.wait(started.json.run.id);
	const first = store.answers.listByRun(started.json.run.id)[0];
	store.answers.setSentiment(first?.id ?? "", "negative");
	const run = await call("GET", `/api/runs/${started.json.run.id}`);
	expect(run.json.answers[0].sentiment).toBe("negative");
});

test("a question can be tagged, and the report and export follow the tag", async () => {
	const { call, runs } = setup();
	const id = await project(call);
	const listed = await call("GET", `/api/projects/${id}/prompts`);
	const promptId = listed.json.prompts[0].id;
	expect(listed.json.prompts[0].tags).toEqual([]);

	const tagged = await call("PATCH", `/api/prompts/${promptId}`, { tags: [" Pricing ", "pricing", "Top"] });
	expect(tagged.status).toBe(200);
	expect(tagged.json.prompt.tags).toEqual(["Pricing", "Top"]);
	expect(tagged.json.prompt.active).toBe(true);
	expect((await call("PATCH", `/api/prompts/${promptId}`, {})).status).toBe(400);
	expect((await call("PATCH", `/api/prompts/${promptId}`, { tags: "Pricing" })).status).toBe(400);

	const started = await call("POST", `/api/projects/${id}/runs`);
	await runs.wait(started.json.run.id);
	const all = await call("GET", `/api/projects/${id}/report`);
	const some = await call("GET", `/api/projects/${id}/report?tag=pricing`);
	expect(some.json.overall.metrics.answers).toBe(1);
	expect(all.json.overall.metrics.answers).toBeGreaterThan(1);
	expect(all.json.overall.sentiment).toEqual({ score: null, positive: 0, neutral: 0, negative: 0 });

	const csv = await call("GET", `/api/projects/${id}/export/answers.csv`);
	expect(csv.status).toBe(200);
	expect(csv.headers.get("content-type")).toContain("text/csv");
	expect(csv.headers.get("content-disposition")).toContain("attachment");
	expect(csv.text.split("\r\n")[0]).toContain("run_started,engine");
	expect(csv.text).toContain("Pricing; Top");
	expect((await call("GET", "/api/projects/missing/export/answers.csv")).status).toBe(404);
});

test("progress reports the latest run and audit without building a report", async () => {
	const { call, runs } = setup({ delayMs: 30 });
	const id = await project(call);
	expect((await call("GET", `/api/projects/${id}/progress`)).json).toEqual({ run: null, audit: null });
	const started = await call("POST", `/api/projects/${id}/runs`);
	const during = await call("GET", `/api/projects/${id}/progress`);
	expect(during.json.run).toMatchObject({ id: started.json.run.id, status: "running" });
	await runs.wait(started.json.run.id);
	const after = await call("GET", `/api/projects/${id}/progress`);
	expect(after.json.run).toMatchObject({ status: "done", completed: after.json.run.total });
	expect((await call("GET", "/api/projects/missing/progress")).status).toBe(404);
});

test("the plan can be read and a step marked done; an unknown step is refused", async () => {
	const { call, runs } = setup();
	const created = await call("POST", "/api/projects", {
		name: "Unnamed Brand",
		aliases: [],
		domains: ["unnamed.example"],
		competitors: [{ name: "HubSpot", aliases: [], domains: [] }],
		prompts: ["best crm?"],
	});
	const id = created.json.project.id as string;
	expect((await call("GET", `/api/projects/${id}/plan`)).json).toEqual({ steps: [], done: 0 });
	const started = await call("POST", `/api/projects/${id}/runs`);
	await runs.wait(started.json.run.id);
	const plan = await call("GET", `/api/projects/${id}/plan`);
	const step = plan.json.steps[0].id as string;
	const marked = await call("PUT", `/api/projects/${id}/plan/${step}`, { done: true });
	expect(marked.json.done).toBe(1);
	expect(marked.json.steps[0].done).toBe(true);
	expect((await call("PUT", `/api/projects/${id}/plan/nope`, { done: true })).status).toBe(404);
	expect((await call("PUT", `/api/projects/${id}/plan/${step}`, { done: "yes" })).status).toBe(400);
});
