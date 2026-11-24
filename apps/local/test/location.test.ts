import { expect, test } from "bun:test";
import { askContext } from "../src/ask";
import { brandQuestion } from "../src/brand-check";
import { buildCompetitorPrompt } from "../src/competitor-ideas";
import type { EngineStatus } from "../src/engines";
import { cleanLocation, withLocation } from "../src/location";
import { createRunService } from "../src/runs";
import { createHandler } from "../src/server/handler";
import { suggestPrompts } from "../src/suggest";
import { fakeProvider, freshStore, seed } from "./helpers";

test("a question is left alone without a location and says where the asker is with one", () => {
	expect(withLocation("best crm?", "")).toBe("best crm?");
	expect(withLocation("best crm?", "London, United Kingdom")).toBe("best crm?\n\nI am in London, United Kingdom.");
});

test("a location is kept to one short line", () => {
	expect(cleanLocation("  London,\n United   Kingdom ")).toBe("London, United Kingdom");
	expect(cleanLocation("x".repeat(200)).length).toBe(80);
});

test("a brand keeps its location, and saving other details does not clear it", () => {
	const store = freshStore();
	const created = store.projects.create({
		name: "Xenet",
		aliases: [],
		domains: [],
		location: " Cape Town,  South Africa ",
	});
	expect(created.location).toBe("Cape Town, South Africa");
	expect(seed(store).location).toBe("");
	const renamed = store.projects.update(created.id, { name: "Xenet AI", aliases: [], domains: [] });
	expect(renamed?.location).toBe("Cape Town, South Africa");
	expect(store.projects.update(created.id, { ...created, location: "" })?.location).toBe("");
});

test("a run asks each question from the brand's location and still files the answer under its question", async () => {
	const store = freshStore();
	const project = seed(store, ["best crm?"]);
	store.projects.update(project.id, { ...project, location: "Berlin, Germany" });
	const claude = fakeProvider("claude-cli", () => "Pipedrive.");
	const runs = createRunService({ store, providers: () => [claude.provider] });
	const run = await runs.wait(runs.start(project.id).id);
	expect(claude.calls).toEqual(["best crm?\n\nI am in Berlin, Germany."]);
	const [prompt] = store.prompts.list(project.id);
	expect(store.answers.listByRun(run.id).map((a) => a.promptId)).toEqual([prompt?.id as string]);
});

test("the brand check, question ideas, competitor search and assistant are told the location", async () => {
	const store = freshStore();
	const seeded = seed(store);
	const project = store.projects.update(seeded.id, { ...seeded, location: "Lagos, Nigeria" });
	if (!project) throw new Error("missing project");
	expect(brandQuestion(project)).toEndWith("I am in Lagos, Nigeria.");

	const claude = fakeProvider("claude-cli", () => '["Which CRM works for a small team?"]');
	await suggestPrompts(claude.provider, {
		brand: "Pipedrive",
		domains: [],
		competitors: [],
		location: "Lagos, Nigeria",
	});
	expect(claude.calls[0]).toContain("Its buyers are in Lagos, Nigeria.");

	const context = { brand: "Pipedrive", domains: [], about: null, questions: [], answers: [], existing: [] };
	expect(buildCompetitorPrompt({ ...context, location: "Lagos, Nigeria" })).toContain("buyers in Lagos, Nigeria");
	expect(buildCompetitorPrompt(context)).not.toContain("buyers in");

	expect(askContext(store, project).facts).toContain("Location of the brand's buyers: Lagos, Nigeria");
});

test("the location can be set when a brand is created and changed later", async () => {
	const store = freshStore();
	const engines = (): EngineStatus[] => [];
	const handler = createHandler({
		store,
		runs: createRunService({ store, providers: () => [] }),
		engines,
		token: "t",
		port: 4747,
		assets: () => null,
	});
	const call = async (method: string, path: string, body: unknown) => {
		const response = await handler(
			new Request(`http://127.0.0.1:4747${path}`, {
				method,
				headers: { host: "127.0.0.1:4747", "x-openaeo-token": "t", "content-type": "application/json" },
				body: JSON.stringify(body),
			}),
		);
		return { status: response.status, json: (await response.json()) as { project: { id: string; location: string } } };
	};
	const created = await call("POST", "/api/projects", { name: "Xenet", location: "London, United Kingdom" });
	expect(created.json.project.location).toBe("London, United Kingdom");
	const id = created.json.project.id;
	const changed = await call("PATCH", `/api/projects/${id}`, {
		name: "Xenet",
		aliases: [],
		domains: [],
		location: "Dublin",
	});
	expect(changed.json.project.location).toBe("Dublin");
	const tooLong = await call("PATCH", `/api/projects/${id}`, { name: "Xenet", location: "x".repeat(81) });
	expect(tooLong.status).toBe(400);
});
