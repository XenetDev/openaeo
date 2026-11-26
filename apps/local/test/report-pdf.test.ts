import { expect, test } from "bun:test";
import type { AnswerView } from "../src/api-types";
import { toAnswerMarkup } from "../web/src/screens/answer-markup";
import { enginesIn, groupByQuestion, markupBlocks, reportFileName } from "../web/src/screens/report-pdf";

const answer = (over: Partial<AnswerView>): AnswerView => ({
	id: Math.random().toString(36).slice(2),
	engine: "claude",
	promptId: "p1",
	promptText: "Best CRM?",
	text: "",
	searched: true,
	durationMs: 1000,
	errorCode: null,
	errorMessage: null,
	mentions: [],
	brandRank: null,
	brandCited: false,
	citations: [],
	sources: [],
	sentiment: null,
	createdAt: 0,
	model: null,
	inputTokens: null,
	outputTokens: null,
	...over,
});

test("answer markup becomes paragraphs and lists with bold runs", () => {
	const { answer: markup } = toAnswerMarkup(
		"## Top picks\n\n- **Acme** is fast\n- Globex is cheap\n\nPick one.",
		[],
		["Globex"],
	);
	expect(markupBlocks(markup)).toEqual([
		{ kind: "paragraph", parts: [{ text: "Top picks", bold: true }] },
		{
			kind: "list",
			items: [
				[
					{ text: "Acme", bold: true },
					{ text: " is fast", bold: false },
				],
				[
					{ text: "Globex", bold: true },
					{ text: " is cheap", bold: false },
				],
			],
		},
		{ kind: "paragraph", parts: [{ text: "Pick one.", bold: false }] },
	]);
});

test("lines of one paragraph join, and a blank line starts a new one", () => {
	expect(markupBlocks("one\ntwo\n\nthree")).toEqual([
		{ kind: "paragraph", parts: [{ text: "one two", bold: false }] },
		{ kind: "paragraph", parts: [{ text: "three", bold: false }] },
	]);
});

test("answers group by question in engine order and count where the brand was named", () => {
	const answers = [
		answer({ engine: "gemini", brandRank: 2 }),
		answer({ engine: "claude", brandRank: null }),
		answer({ engine: "grok", errorCode: "timeout" }),
		answer({ engine: "claude", promptId: "p2", promptText: "Cheapest CRM?", brandRank: 1 }),
	];
	const groups = groupByQuestion(answers, ["claude", "gemini", "grok"], new Map([["p1", ["crm"]]]));
	expect(groups.map((g) => g.question)).toEqual(["Best CRM?", "Cheapest CRM?"]);
	expect(groups[0]?.answers.map((a) => a.engine)).toEqual(["claude", "gemini", "grok"]);
	expect(groups[0]).toMatchObject({ tags: ["crm"], named: 1, answered: 2 });
	expect(groups[1]).toMatchObject({ tags: [], named: 1, answered: 1 });
	expect(enginesIn(answers)).toEqual(["gemini", "claude", "grok"]);
});

test("the file name carries the brand, the tag and the run date", () => {
	const started = Date.UTC(2026, 10, 26, 9, 30);
	expect(reportFileName("Xenet AI", started)).toBe("xenet-ai-ai-visibility-2026-11-26");
	expect(reportFileName("Xenet", started, "Agents & Ops")).toBe("xenet-ai-visibility-agents-ops-2026-11-26");
	expect(reportFileName("!!!", null)).toBe("openaeo-ai-visibility");
});
