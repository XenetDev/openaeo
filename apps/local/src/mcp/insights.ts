import { z } from "zod";
import { buildOpportunities } from "../opportunities";
import { buildSources } from "../report";
import { ANSWER_NOTICE, count, isReply, type McpContext, oneLine, projectArg, say, tagArg, when } from "./shared";

const MAX_NAMED = 8;
const more = (total: number, shown: number) =>
	total > shown ? [`  …and ${total - shown} more; pass a higher limit to see them.`] : [];

export function registerInsightTools({ server, store, resolve, label }: McpContext): void {
	server.registerTool(
		"get_opportunities",
		{
			description:
				"Find where a brand can gain ground, from its latest finished run: the questions where AI engines named a competitor and not the brand (with which engines, and who was named instead), the outside sites the engines cite that are worth being mentioned on, and the website fixes that matter most.",
			inputSchema: {
				...projectArg,
				limit: z.number().int().min(1).max(100).optional().describe("Maximum entries in each section. Default 25."),
			},
			annotations: { readOnlyHint: true },
		},
		async ({ project, limit }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const { runId, missed, sites, fixes } = await buildOpportunities(store, found.id);
			const max = limit ?? 25;
			if (missed.length + sites.length + fixes.length === 0)
				return say(
					runId
						? `Nothing to chase right now for ${found.name}: it is named wherever its competitors are, and no outside site is being cited. Add more questions with add_questions to look wider.`
						: `No finished run yet for ${found.name}, so there are no opportunities to list. Use run_prompts to start a run, and run_audit to find website fixes.`,
				);
			const lines = [
				`Opportunities for ${found.name}${runId ? ", from the latest finished run" : " (no finished run yet; use run_prompts to start one)"}`,
				`${count(missed.length, "question")} it is missing from · ${count(sites.length, "site")} worth being on · ${fixes.length} website ${fixes.length === 1 ? "fix" : "fixes"}`,
			];
			if (missed.length > 0)
				lines.push(
					"",
					`Questions where a competitor is named and ${found.name} is not`,
					...missed
						.slice(0, max)
						.flatMap((miss) => [
							`  ${oneLine(miss.question)}`,
							`    Not named by: ${miss.engines.map(label).join(", ")}`,
							`    Named instead: ${miss.named.slice(0, MAX_NAMED).map(oneLine).join(", ")}${
								miss.named.length > MAX_NAMED ? ` and ${miss.named.length - MAX_NAMED} more` : ""
							}`,
						]),
					...more(missed.length, max),
					"  Use list_answers with a question to read what earned the competitor the mention.",
				);
			if (fixes.length > 0)
				lines.push(
					"",
					"Website fixes that matter most, from the latest audit (get_fix_brief has the instructions)",
					...fixes.slice(0, max).map((fix) => `  [${fix.severity}] ${fix.title} (${count(fix.pages, "page")})`),
					...more(fixes.length, max),
				);
			if (sites.length > 0)
				lines.push(
					"",
					`Sites worth being mentioned on: cited by the engines, owned by neither ${found.name} nor a competitor`,
					ANSWER_NOTICE,
					...sites
						.slice(0, max)
						.map(
							(site) =>
								`> ${oneLine(site.domain)}: cited ${count(site.citations, "time")} across ${count(site.questions, "question")}`,
						),
					...(sites.length > max ? [`…and ${sites.length - max} more; pass a higher limit to see them.`] : []),
				);
			return say(lines.join("\n"));
		},
	);

	server.registerTool(
		"list_sources",
		{
			description:
				"List the websites AI engines cited in a brand's latest finished run, most cited first: how many citations each got, whether it is the brand's own site, which engines cited it and in how many questions. These are the places worth being mentioned on.",
			inputSchema: {
				...projectArg,
				tag: tagArg.optional().describe("Only count answers to questions with this tag."),
				limit: z.number().int().min(1).max(100).optional().describe("Maximum sites to return. Default 25."),
			},
			annotations: { readOnlyHint: true },
		},
		async ({ project, tag, limit }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const { run, sites } = await buildSources(store, found.id, { tag });
			if (!run) return say(`No sources yet for ${found.name}: there is no run. Use run_prompts to start one.`);
			if (sites.length === 0)
				return say(
					`No sources yet for ${found.name}: the engines answered the run of ${when(run.startedAt)} without linking to any site${tag ? ` for questions tagged "${oneLine(tag)}"` : ""}.`,
				);
			const shown = sites.slice(0, limit ?? 25);
			return say(
				[
					`${count(sites.length, "site")} cited in the run of ${when(run.startedAt)} for ${found.name}${
						tag ? `, for questions tagged "${oneLine(tag)}"` : ""
					}, most cited first${shown.length < sites.length ? ` (showing ${shown.length})` : ""}.`,
					ANSWER_NOTICE,
					...shown.map(
						(site) =>
							`> ${oneLine(site.domain)}: ${count(site.citations, "citation")} · ${site.isBrand ? "yours" : "another site"} · cited by ${site.engines
								.map(label)
								.join(", ")} · in ${count(site.questions, "question")}`,
					),
				].join("\n"),
			);
		},
	);
}
