import { expect, test } from "bun:test";
import { buildCompetitorInsight } from "../src/competitor-insight";
import { createRunService } from "../src/runs";
import { fakeProvider, freshStore, seed, src } from "./helpers";

async function world() {
	const store = freshStore();
	const project = seed(store, ["best crm?", "cheapest crm?"]);
	const engine = fakeProvider("claude-cli", (prompt) =>
		prompt.includes("best")
			? {
					text: "Many teams start here.\n\n**HubSpot** is the best all-round CRM, with a free plan and strong reporting. Attio is newer.",
					citations: [
						src("https://www.g2.com/crm"),
						src("https://hubspot.com/pricing"),
						src("https://hubspot.com/pricing"),
					],
				}
			: {
					text: "Pipedrive is the cheapest, then HubSpot for larger teams.",
					citations: [src("https://www.g2.com/crm"), src("https://capterra.com/crm")],
				},
	);
	const runs = createRunService({ store, providers: () => [engine.provider] });
	await runs.wait((await runs.start(project.id)).id);
	return { store, project };
}

test("shows the questions a competitor is named for, with the ones the brand misses first", async () => {
	const { store, project } = await world();
	const insight = await buildCompetitorInsight(store, project.id, "hubspot");
	expect(insight).not.toBeNull();
	expect(insight?.name).toBe("HubSpot");
	expect(insight?.answers).toBe(2);
	expect(insight?.named).toBe(2);
	expect(insight?.questions).toEqual([
		{ question: "best crm?", engines: ["claude-cli"], brandNamed: false },
		{ question: "cheapest crm?", engines: ["claude-cli"], brandNamed: true },
	]);
});

test("quotes what the engines said about the competitor, without markdown", async () => {
	const { store, project } = await world();
	const insight = await buildCompetitorInsight(store, project.id, "HubSpot");
	expect(insight?.quotes[0]).toEqual({
		engine: "claude-cli",
		question: "best crm?",
		text: "HubSpot is the best all-round CRM, with a free plan and strong reporting.",
	});
	expect(insight?.quotes).toHaveLength(2);
});

test("separates the competitor's own cited pages from the other sites behind its mentions", async () => {
	const { store, project } = await world();
	const insight = await buildCompetitorInsight(store, project.id, "HubSpot");
	expect(insight?.pages).toEqual([{ url: "https://hubspot.com/pricing", title: null, citations: 2 }]);
	expect(insight?.sites).toEqual([
		{ domain: "g2.com", citations: 2, namesBrand: true },
		{ domain: "capterra.com", citations: 1, namesBrand: true },
	]);
});

test("a competitor nobody named has an empty picture, and an unknown name has none", async () => {
	const { store, project } = await world();
	const quiet = await buildCompetitorInsight(store, project.id, "Attio");
	expect(quiet?.named).toBe(1);
	store.competitors.replace(project.id, [{ name: "Zoho", aliases: [], domains: [] }]);
	const unnamed = await buildCompetitorInsight(store, project.id, "Zoho");
	expect(unnamed).toMatchObject({ named: 0, questions: [], quotes: [], sites: [], pages: [] });
	expect(await buildCompetitorInsight(store, project.id, "Nobody")).toBeNull();
});
