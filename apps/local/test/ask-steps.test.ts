import { expect, test } from "bun:test";
import { type AskFacts, thinkingSteps } from "../web/src/screens/ask-steps";

const facts: AskFacts = {
	brand: "Xenet",
	answers: 15,
	engines: ["ChatGPT", "Claude", "Gemini"],
	competitors: ["Accenture", "Deloitte"],
	prompts: 5,
	audit: { score: 62, pages: 14, findings: 9 },
	openSteps: 4,
};
const empty: AskFacts = {
	brand: "Xenet",
	answers: 0,
	engines: [],
	competitors: [],
	prompts: 0,
	audit: null,
	openSteps: 0,
};
const steps = (question: string, with_ = facts) => thinkingSteps(question, "Claude", with_);

test("a competitor question reads the run and names the tracked competitors", () => {
	expect(steps("lets add peec ai as a competitor")).toEqual([
		"Reading 15 answers from ChatGPT, Claude and Gemini",
		"Comparing Xenet with Accenture and Deloitte",
		"Writing the answer with Claude",
	]);
});

test("long lists are cut to two names and a count", () => {
	expect(steps("who is ahead of me?", { ...facts, competitors: ["A", "B", "C", "D"] })[1]).toBe(
		"Comparing Xenet with A, B and 2 more",
	);
});

test("many engines are counted, not listed", () => {
	expect(steps("why am I not showing up?", { ...facts, engines: ["A", "B", "C", "D", "E"] })[0]).toBe(
		"Reading 15 answers from 5 engines",
	);
});

test("a setup question reads the guide, not the run", () => {
	expect(steps("How do I setup the OpenAEO mcp?")).toEqual([
		"Reading the OpenAEO guide",
		"Writing the answer with Claude",
	]);
});

test("a website question reads the real audit", () => {
	expect(steps("what should I fix on my website?")).toEqual([
		"Reading your site audit: 62 of 100 across 14 pages",
		"Going through 9 findings",
		"Writing the answer with Claude",
	]);
});

test("a plan question counts the open steps", () => {
	expect(steps("what should I do next?")[1]).toBe("Checking your plan: 4 steps open");
	expect(steps("what should I do next?", { ...facts, openSteps: 1 })[1]).toBe("Checking your plan: 1 step open");
});

test("a schedule question counts the tracked questions", () => {
	expect(steps("run my prompts every week")).toEqual([
		"Checking your 5 tracked questions",
		"Checking your run schedule",
		"Writing the answer with Claude",
	]);
});

test("anything else reads the answers and looks for the brand", () => {
	expect(steps("why am I not showing up?")).toEqual([
		"Reading 15 answers from ChatGPT, Claude and Gemini",
		"Checking where Xenet is named",
		"Writing the answer with Claude",
	]);
});

test("nothing is invented before the first run or audit", () => {
	expect(steps("why am I not showing up?", empty)[0]).toBe("No finished run yet, reading your setup");
	expect(steps("what should I fix on my website?", empty)).toEqual([
		"No site audit yet, reading your setup",
		"Writing the answer with Claude",
	]);
	expect(steps("who is ahead of me, which competitor?", empty)[1]).toBe("No competitors tracked yet");
});

test("the last step drops the engine name when it is unknown", () => {
	expect(thinkingSteps("hello", "", facts).at(-1)).toBe("Writing the answer");
});
