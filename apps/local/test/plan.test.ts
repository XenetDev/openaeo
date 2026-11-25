import { expect, test } from "bun:test";
import { brandQuestion } from "../src/brand-check";
import { buildPlan, setStepDone } from "../src/plan";
import { createRunService } from "../src/runs";
import { fakeProvider, freshStore, seed, src } from "./helpers";

function world(analysis: unknown[], answer = "HubSpot is best.") {
	const store = freshStore();
	const project = seed(store, ["best crm?", "cheapest crm?"]);
	const engine = fakeProvider("claude-cli", (prompt) => {
		if (prompt.includes("You are checking what AI assistants know")) return JSON.stringify(analysis);
		if (prompt === brandQuestion(store.projects.get(project.id) as never))
			return {
				text: "Pipedrive is a CRM with 200 staff, though one source says 7.",
				citations: [src("https://g2.com/p")],
			};
		return { text: answer, citations: [src("https://capterra.com/crm"), src("https://capterra.com/b")] };
	});
	const runs = createRunService({ store, providers: () => [engine.provider], brandCheck: true });
	return { store, project, runs };
}

test("a brand that is not named gets a plan built from its own results", async () => {
	const { store, project, runs } = world([
		{ n: 1, knows: "yes", summary: "A CRM.", confusedWith: ["Pipefy"], concerns: ["Staff numbers conflict."] },
	]);
	await runs.wait((await runs.start(project.id)).id);
	const plan = await buildPlan(store, project.id);
	expect(plan.steps.map((step) => step.id)).toEqual(["facts", "questions", "profiles", "sources", "identity"]);
	expect(plan.done).toBe(0);

	const byId = new Map(plan.steps.map((step) => [step.id, step]));
	expect(byId.get("facts")?.evidence).toEqual(["Staff numbers conflict."]);
	expect(byId.get("questions")?.evidence).toEqual(["best crm?", "cheapest crm?"]);
	expect(byId.get("questions")?.ask).toContain("best crm?");
	expect(byId.get("profiles")?.links).toEqual([{ label: "g2.com", url: "https://g2.com" }]);
	expect(byId.get("sources")?.links).toEqual([{ label: "capterra.com", url: "https://capterra.com" }]);
	expect(byId.get("identity")?.evidence).toEqual(["Pipefy"]);
	for (const step of plan.steps) {
		expect(step.how.length).toBeGreaterThan(0);
		expect(step.why).not.toBe("");
	}
});

test("steps can be marked done and undone, and that survives rebuilding the plan", async () => {
	const { store, project, runs } = world([{ n: 1, knows: "yes", summary: "A CRM.", confusedWith: [], concerns: [] }]);
	await runs.wait((await runs.start(project.id)).id);
	await setStepDone(store, project.id, "questions", true);
	await setStepDone(store, project.id, "questions", true);
	const plan = await buildPlan(store, project.id);
	expect(plan.steps.find((step) => step.id === "questions")?.done).toBe(true);
	expect(plan.done).toBe(1);
	await setStepDone(store, project.id, "questions", false);
	expect((await buildPlan(store, project.id)).done).toBe(0);
});

test("an engine that does not know the brand comes first, and audit findings become a step", async () => {
	const { store, project, runs } = world([{ n: 1, knows: "no", summary: null, confusedWith: [], concerns: [] }]);
	await runs.wait((await runs.start(project.id)).id);
	const audit = store.audits.create(project.id, "https://pipedrive.com", true);
	store.audits.finish(audit.id, "done", {
		origin: "https://pipedrive.com",
		startedAt: Date.now(),
		pages: [{ url: "https://pipedrive.com/", status: 200, words: 500 }],
		findings: [
			{
				checkId: "no-structured-data",
				severity: "medium",
				url: "https://pipedrive.com/",
				title: "No structured data",
				evidence: "",
				fix: "",
			},
		],
		score: 80,
		skipped: [],
	});
	const ids = (await buildPlan(store, project.id)).steps.map((step) => step.id);
	expect(ids[0]).toBe("unknown");
	expect(ids).toContain("website");
});

test("a brand that is named everywhere, and a brand with no run, have nothing to do", async () => {
	const { store, project, runs } = world(
		[{ n: 1, knows: "yes", summary: "A CRM.", confusedWith: [], concerns: [] }],
		"Pipedrive is best.",
	);
	await runs.wait((await runs.start(project.id)).id);
	expect((await buildPlan(store, project.id)).steps.map((step) => step.id)).toEqual(["profiles"]);
	expect(await buildPlan(store, seed(freshStore()).id)).toEqual({ steps: [], done: 0 });
});
