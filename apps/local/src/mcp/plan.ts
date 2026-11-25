import { QUOTE_NOTICE } from "@openaeo/engine";
import { z } from "zod";
import { buildPlan, setStepDone } from "../plan";
import { fail, isReply, type McpContext, oneLine, projectArg, say } from "./shared";

export function registerPlanTools({ server, store, resolve }: McpContext): void {
	server.registerTool(
		"get_plan",
		{
			description:
				"Get the plan for getting a brand recommended by AI engines: the steps in order of importance, why each matters, what to do, and which are already marked done. Each step has an id to use with mark_plan_step.",
			inputSchema: projectArg,
			annotations: { readOnlyHint: true },
		},
		async ({ project }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const plan = await buildPlan(store, found.id);
			if (plan.steps.length === 0) return say(`There is no plan for ${found.name} yet. Start a run or an audit first.`);
			const steps = plan.steps.map((step) =>
				[
					`[${step.done ? "x" : " "}] ${step.id} · ${step.severity} · ${step.title}`,
					`    Why: ${step.why}`,
					...step.how.map((line, index) => `    ${index + 1}. ${line}`),
				].join("\n"),
			);
			const evidence = plan.steps.flatMap((step) => step.evidence.map((line) => `> [${step.id}] ${oneLine(line)}`));
			return say(
				[
					`Plan for ${found.name}: ${plan.done} of ${plan.steps.length} steps done`,
					"",
					steps.join("\n\n"),
					...(evidence.length > 0 ? ["", "From the engines and the audit", QUOTE_NOTICE, ...evidence] : []),
				].join("\n"),
			);
		},
	);

	server.registerTool(
		"mark_plan_step",
		{
			description:
				"Mark a step of a brand's plan as done, or not done, after the work has actually been carried out. Use the step id from get_plan. This only records progress; it does not change the website.",
			inputSchema: {
				...projectArg,
				step: z.string().max(80).describe("The step id from get_plan, for example `questions` or `website`."),
				done: z.boolean().optional().describe("Whether the step is done. Defaults to true."),
			},
			annotations: { readOnlyHint: false },
		},
		async ({ project, step, done }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const plan = await buildPlan(store, found.id);
			const target = plan.steps.find((candidate) => candidate.id === step.trim());
			if (!target)
				return fail(
					`There is no step "${step}" in the plan for ${found.name}. Steps: ${plan.steps.map((s) => s.id).join(", ") || "none"}.`,
				);
			await setStepDone(store, found.id, target.id, done ?? true);
			return say(`Marked "${target.title}" as ${(done ?? true) ? "done" : "not done"} for ${found.name}.`);
		},
	);
}
