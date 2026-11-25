import { expect, test } from "bun:test";
import { buildOpportunities } from "../src/opportunities";
import { createRunService } from "../src/runs";
import { fakeProvider, freshStore, seed, src } from "./helpers";

async function world(reply: (prompt: string) => string) {
	const store = freshStore();
	const project = seed(store, ["best crm?", "cheapest crm?"]);
	const engine = fakeProvider("claude-cli", (prompt) => ({
		text: reply(prompt),
		citations: [
			src("https://www.g2.com/crm"),
			src("https://hubspot.com/pricing"),
			src("https://pipedrive.com/features"),
		],
	}));
	const runs = createRunService({ store, providers: () => [engine.provider] });
	await runs.wait((await runs.start(project.id)).id);
	return { store, project };
}

test("a question where a competitor is named and the brand is not is a missed question", async () => {
	const { store, project } = await world((prompt) =>
		prompt.includes("best") ? "HubSpot is the best choice." : "Pipedrive is the cheapest, then HubSpot.",
	);
	const found = await buildOpportunities(store, project.id);
	expect(found.missed).toEqual([{ question: "best crm?", engines: ["claude-cli"], named: ["HubSpot"] }]);
});

test("sites to get mentioned on leave out the brand's own site and competitors' sites", async () => {
	const { store, project } = await world(() => "HubSpot is the best choice.");
	const found = await buildOpportunities(store, project.id);
	expect(found.sites).toEqual([{ domain: "g2.com", citations: 2, questions: 2 }]);
});

test("a brand with no finished run has nothing to report", async () => {
	const store = freshStore();
	const project = seed(store);
	expect(await buildOpportunities(store, project.id)).toEqual({ runId: null, missed: [], sites: [], fixes: [] });
});
