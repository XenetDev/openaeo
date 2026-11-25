import { expect, test } from "bun:test";
import { answersCsv, CSV_BOM, questionsCsv, toCsv } from "../src/export";
import { createRunService } from "../src/runs";
import { fakeProvider, freshStore, seed, src } from "./helpers";

test("csv cells are quoted when they need it and formulas are neutralised", () => {
	const csv = toCsv([
		["plain", 'has "quotes"', "has,comma", "two\nlines"],
		["=SUM(A1)", "+1", "-2", "@cmd", 3, null],
	]);
	expect(csv).toBe(['plain,"has ""quotes""","has,comma","two\nlines"', "'=SUM(A1),'+1,'-2,'@cmd,3,", ""].join("\r\n"));
});

test("the answers export has one row per answer with what each engine said about the brand", async () => {
	const store = freshStore();
	const project = seed(store, ["best crm?"]);
	const [prompt] = store.prompts.list(project.id);
	store.prompts.setTags(prompt?.id as string, ["Pricing", "Top"]);
	const claude = fakeProvider("claude-cli", () => ({
		text: "HubSpot first, then Pipedrive.",
		citations: [src("https://pipedrive.com/pricing"), src("https://g2.com/x")],
	}));
	const runs = createRunService({ store, providers: () => [claude.provider] });
	const run = await runs.wait((await runs.start(project.id)).id);
	store.answers.setSentiment(store.answers.listByRun(run.id)[0]?.id as string, "positive");

	const csv = await answersCsv(store, project.id);
	expect(csv.startsWith(CSV_BOM)).toBe(true);
	const [header, row, tail] = csv.slice(CSV_BOM.length).split("\r\n");
	expect(header).toBe(
		"run_started,engine,model,question,tags,mentioned,position,own_site_cited,sentiment,brands_named,cited_sites,error,answer",
	);
	const cells = row?.split(",") ?? [];
	expect(cells[1]).toBe("claude-cli");
	expect(cells[3]).toBe("best crm?");
	expect(cells[4]).toBe("Pricing; Top");
	expect(cells.slice(5, 9)).toEqual(["yes", "2", "yes", "positive"]);
	expect(row).toContain("HubSpot; Pipedrive");
	expect(row).toContain("pipedrive.com; g2.com");
	expect(tail).toBe("");
	expect(await answersCsv(store, seed(freshStore()).id)).toBe(`${CSV_BOM}${header}\r\n`);
});

test("the questions export has one row per question with how often the brand was mentioned", async () => {
	const store = freshStore();
	const project = seed(store, ["best crm?", "=cheapest crm?"]);
	const [first] = store.prompts.list(project.id);
	store.prompts.setTags(first?.id as string, ["Pricing"]);
	const claude = fakeProvider("claude-cli", (prompt) =>
		prompt.includes("best") ? "HubSpot first, then Pipedrive." : "HubSpot only.",
	);
	const runs = createRunService({ store, providers: () => [claude.provider] });
	await runs.wait((await runs.start(project.id)).id);

	const csv = await questionsCsv(store, project.id);
	expect(csv.startsWith(CSV_BOM)).toBe(true);
	const [header, best, cheapest, tail] = csv.slice(CSV_BOM.length).split("\r\n");
	expect(header).toBe("question,tags,tracked,mentioned_percent,previous_percent,best_position,runs,last_run");
	expect(best?.split(",").slice(0, 7)).toEqual(["best crm?", "Pricing", "yes", "100", "", "2", "1"]);
	expect(cheapest?.split(",").slice(0, 7)).toEqual(["'=cheapest crm?", "", "yes", "0", "", "", "1"]);
	expect(tail).toBe("");
});
