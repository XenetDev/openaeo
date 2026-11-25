import { z } from "zod";
import { promptStats } from "../report";
import { PromptTextSchema } from "../server/schemas";
import { count, fail, isReply, type McpContext, oneLine, percent, projectArg, sameText, say } from "./shared";

export type McpLimits = {
	questions?: (projectId: string, adding: number) => Promise<string | null>;
};

export function registerQuestionTools({ server, store, resolve }: McpContext, limits: McpLimits = {}): void {
	server.registerTool(
		"list_questions",
		{
			description:
				"List the questions a brand tracks in AI engines: whether each is active or paused, its tags, its id, and how often the brand was mentioned in its latest finished run.",
			inputSchema: projectArg,
			annotations: { readOnlyHint: true },
		},
		async ({ project }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const prompts = await store.prompts.list(found.id);
			if (prompts.length === 0)
				return say(`No questions are tracked for ${found.name} yet. Use add_questions to add some.`);
			const latest = new Map((await promptStats(store, found.id)).map((stat) => [stat.promptId, stat.latest]));
			const active = prompts.filter((p) => p.active).length;
			const blocks = prompts.map((prompt) => {
				const rate = latest.get(prompt.id) ?? null;
				const parts = [
					`[${prompt.active ? "active" : "paused"}] ${oneLine(prompt.text)}`,
					prompt.tags.length > 0 ? `tags: ${prompt.tags.map(oneLine).join(", ")}` : "",
					rate === null ? "" : `mentioned in ${percent(rate)} of answers`,
				];
				return `${parts.filter(Boolean).join(" · ")}\n    id ${prompt.id}`;
			});
			return say(
				[
					`${count(prompts.length, "question")} tracked for ${found.name} (${active} active, ${prompts.length - active} paused)`,
					"",
					...blocks,
					"",
					"Use add_questions to track more, or set_question_active to pause or resume one.",
				].join("\n"),
			);
		},
	);

	server.registerTool(
		"add_questions",
		{
			description:
				"Start tracking more questions for a brand: the things buyers ask AI engines. Skips questions already tracked. New questions are asked in the next run, and each one adds to what a run costs.",
			inputSchema: {
				...projectArg,
				questions: z
					.array(PromptTextSchema)
					.min(1)
					.max(20)
					.describe("The questions to add, each written the way a buyer would ask an AI engine."),
			},
			annotations: { readOnlyHint: false },
		},
		async ({ project, questions }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const known = new Set((await store.prompts.list(found.id)).map((p) => sameText(p.text)));
			const fresh: string[] = [];
			const skipped: string[] = [];
			for (const raw of questions) {
				const text = raw.trim();
				if (!text) skipped.push("  (empty): there was no text");
				else if (known.has(sameText(text))) skipped.push(`  ${oneLine(text)}: already tracked`);
				else {
					known.add(sameText(text));
					fresh.push(text);
				}
			}
			if (fresh.length === 0) return fail([`Nothing was added to ${found.name}.`, "Skipped", ...skipped].join("\n"));
			const refusal = await limits.questions?.(found.id, fresh.length);
			if (refusal) return fail(refusal);
			const added = await store.prompts.add(found.id, fresh);
			if (added.length === 0) return fail(`Nothing was added to ${found.name}: those questions are already tracked.`);
			return say(
				[
					`Added ${count(added.length, "question")} to ${found.name}`,
					...added.map((prompt) => `  ${oneLine(prompt.text)}`),
					...(skipped.length > 0 ? ["Skipped", ...skipped] : []),
					"They are asked in the next run; use run_prompts to start one.",
				].join("\n"),
			);
		},
	);

	server.registerTool(
		"set_question_active",
		{
			description:
				"Pause or resume one tracked question of a brand. A paused question is skipped in future runs and keeps its history; resuming it asks it again from the next run.",
			inputSchema: {
				...projectArg,
				question: z
					.string()
					.trim()
					.min(1)
					.max(2000)
					.describe("The question's exact text, or its id from list_questions."),
				active: z.boolean().describe("true to resume the question, false to pause it."),
			},
			annotations: { readOnlyHint: false },
		},
		async ({ project, question, active }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const prompts = await store.prompts.list(found.id);
			const target =
				prompts.find((p) => p.id === question) ?? prompts.find((p) => sameText(p.text) === sameText(question));
			if (!target)
				return fail(
					`There is no question "${oneLine(question)}" for ${found.name}. Use list_questions to see the tracked questions and their ids.`,
				);
			await store.prompts.setActive(target.id, active);
			return say(
				`${active ? "Resumed" : "Paused"} "${oneLine(target.text)}" for ${found.name}. ${
					active ? "It is asked again from the next run." : "It is skipped from the next run; its history is kept."
				}`,
			);
		},
	);
}
