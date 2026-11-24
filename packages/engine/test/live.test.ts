import { expect, test } from "bun:test";
import { createClaudeCli, createCodexCli } from "../src/cli/index";

const live = process.env.OPENAEO_LIVE === "1";
const prompt = "What is the capital of France? Search the web and cite a source.";

test.skipIf(!live)(
	"claude answers on the local subscription",
	async () => {
		const answer = await createClaudeCli().ask(prompt);
		expect(answer.text).toContain("Paris");
	},
	200_000,
);

test.skipIf(!live)(
	"codex answers on the local subscription",
	async () => {
		const answer = await createCodexCli().ask(prompt);
		expect(answer.text).toContain("Paris");
	},
	200_000,
);
