import { expect, test } from "bun:test";
import { thinkingSteps } from "../web/src/screens/ask-steps";

const first = (question: string) => thinkingSteps(question, "ChatGPT")[0];

test("a question about setting up the agent connection looks up how OpenAEO works", () => {
	expect(first("How do I setup the OpenAEO mcp?")).toBe("Looking up how OpenAEO works");
	expect(first("where do I install the skills")).toBe("Looking up how OpenAEO works");
});

test("a competitor request checks the competitors", () => {
	expect(first("lets add peec ai as a competitor")).toBe("Checking the competitors you track");
});

test("each topic gets its own first step", () => {
	expect(first("what should I fix on my website?")).toBe("Reading your site audit");
	expect(first("what should I do next?")).toBe("Reading your plan");
	expect(first("write me a LinkedIn post")).toBe("Checking your posts");
	expect(first("which sites does AI cite?")).toBe("Reading the sites AI cites");
	expect(first("run my prompts every week")).toBe("Checking your prompts and schedule");
	expect(first("how many credits do I have left")).toBe("Checking your workspace");
});

test("anything else reads the latest answers", () => {
	expect(first("why am I not showing up?")).toBe("Reading your latest answers");
});

test("the second step names the engine, or no engine when it is unknown", () => {
	expect(thinkingSteps("hello", "ChatGPT")[1]).toBe("Writing the answer with ChatGPT");
	expect(thinkingSteps("hello", "")[1]).toBe("Writing the answer");
});
