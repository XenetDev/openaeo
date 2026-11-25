import { z } from "zod";
import { promptStats } from "../report";
import { PromptTagsSchema, PromptTextSchema } from "../server/schemas";
import { projectSuggestContext, type SuggestContext } from "../suggest";
import { cleanTags } from "../tags";
import {
	ANSWER_NOTICE,
	count,
	fail,
	findQuestion,
	isReply,
	type McpContext,
	type McpLimits,
	noQuestion,
	oneLine,
	percent,
	projectArg,
	questionArg,
	sameText,
	say,
} from "./shared";

export type QuestionDeps = {
	limits?: McpLimits;
	suggest?: (context: SuggestContext) => Promise<{ prompts: string[]; fallback: boolean }>;
	describeSite?: (domain: string) => Promise<string | null>;
};

const whichQuestion = questionArg.describe("The question's exact text, or its id from list_questions.");

export function registerQuestionTools({ server, store, resolve }: McpContext, deps: QuestionDeps = {}): void {
	const { limits = {}, suggest, describeSite } = deps;

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
					"Use add_questions to track more, set_question_active to pause or resume one, set_question_tags to group them, or remove_question to drop one.",
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
				question: whichQuestion,
				active: z.boolean().describe("true to resume the question, false to pause it."),
			},
			annotations: { readOnlyHint: false },
		},
		async ({ project, question, active }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const target = findQuestion(await store.prompts.list(found.id), question);
			if (!target) return noQuestion(question, found);
			await store.prompts.setActive(target.id, active);
			return say(
				`${active ? "Resumed" : "Paused"} "${oneLine(target.text)}" for ${found.name}. ${
					active ? "It is asked again from the next run." : "It is skipped from the next run; its history is kept."
				}`,
			);
		},
	);

	server.registerTool(
		"set_question_tags",
		{
			description:
				"Set the tags of one tracked question, replacing the tags it has. Tags group questions so reports, sources and answers can be narrowed to one group. Pass an empty list to clear them.",
			inputSchema: {
				...projectArg,
				question: whichQuestion,
				tags: PromptTagsSchema.describe("The tags the question should have, at most 10 of up to 40 characters each."),
			},
			annotations: { readOnlyHint: false },
		},
		async ({ project, question, tags }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const target = findQuestion(await store.prompts.list(found.id), question);
			if (!target) return noQuestion(question, found);
			const cleaned = cleanTags(tags);
			await store.prompts.setTags(target.id, cleaned);
			return say(
				cleaned.length > 0
					? `"${oneLine(target.text)}" is now tagged: ${cleaned.join(", ")}.`
					: `"${oneLine(target.text)}" now has no tags.`,
			);
		},
	);

	server.registerTool(
		"remove_question",
		{
			description:
				"Stop tracking one question of a brand and delete it from the list. Its past answers stay in old runs, shown as a deleted question, but its history is no longer charted. To skip a question and keep its history, use set_question_active instead. Confirm with the user first.",
			inputSchema: { ...projectArg, question: whichQuestion },
			annotations: { readOnlyHint: false, destructiveHint: true },
		},
		async ({ project, question }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const target = findQuestion(await store.prompts.list(found.id), question);
			if (!target) return noQuestion(question, found);
			await store.prompts.remove(target.id);
			return say(
				`Removed "${oneLine(target.text)}" from the questions of ${found.name}. Its past answers stay in old runs; it is not asked again.`,
			);
		},
	);

	if (suggest)
		server.registerTool(
			"suggest_questions",
			{
				description:
					"Ask the user's AI engine (one request, up to a couple of minutes, spends a little of their AI usage) for questions buyers might ask about what a brand sells. Returns ideas only and saves nothing: show them to the user, then call add_questions with the ones they confirm.",
				inputSchema: projectArg,
				annotations: { readOnlyHint: false, openWorldHint: true },
			},
			async ({ project }) => {
				const found = await resolve(project);
				if (isReply(found)) return found;
				const site = found.domains[0];
				const about = site && describeSite ? await describeSite(site).catch(() => null) : null;
				const context = await projectSuggestContext(store, found, about);
				let ideas: { prompts: string[]; fallback: boolean };
				try {
					ideas = await suggest(context);
				} catch {
					return fail("The AI engine could not suggest questions. Try again, or add questions with add_questions.");
				}
				const known = new Set((context.existing ?? []).map(sameText));
				const fresh = ideas.prompts.filter((text) => text.trim() && !known.has(sameText(text)));
				if (fresh.length === 0)
					return say(
						`Nothing new came back for ${found.name}: every idea is already tracked, or no AI engine is ready. Add questions with add_questions.`,
					);
				return say(
					[
						`${count(fresh.length, "suggested question")} for ${found.name}. Nothing has been saved.`,
						...(ideas.fallback
							? ["No AI engine was ready, so these are generic starting points, not written for this brand."]
							: []),
						"Show these to the user, and once they confirm which to track, call add_questions with those. Each tracked question adds to what a run costs.",
						"",
						ANSWER_NOTICE,
						...fresh.map((text) => `> ${oneLine(text)}`),
					].join("\n"),
				);
			},
		);
}
