import { QUOTE_NOTICE } from "@openaeo/engine";
import { z } from "zod";
import {
	type CompetitorContext,
	type CompetitorIdea,
	projectCompetitorContext,
	websiteDomain,
} from "../competitor-ideas";
import { buildCompetitorInsight } from "../competitor-insight";
import { buildReport } from "../report";
import { EntitySchema, MAX_COMPETITORS, MAX_ENTITY_TEXT } from "../server/schemas";
import type { EntityInput } from "../store/types";
import {
	ANSWER_NOTICE,
	count,
	fail,
	isReply,
	type McpContext,
	oneLine,
	percent,
	projectArg,
	sameText,
	say,
} from "./shared";

export type CompetitorDeps = {
	competitorIdeas?: (context: CompetitorContext) => Promise<CompetitorIdea[]>;
	describeSite?: (domain: string) => Promise<string | null>;
};

const NEXT_RUN = "Competitors are counted from the next run; use run_prompts to start one.";
const label = (name: string, domain: string | null | undefined) =>
	`${oneLine(name)}${domain ? ` (${oneLine(domain)})` : ""}`;

export function registerCompetitorTools(
	{ server, store, resolve, label: engineName }: McpContext,
	deps: CompetitorDeps,
): void {
	const { competitorIdeas, describeSite } = deps;
	const howToAdd = `To track more, call add_competitors with their names and websites${
		competitorIdeas ? ", or find_competitors to get suggestions first" : ""
	}.`;

	server.registerTool(
		"get_competitor",
		{
			description:
				"Explain why one tracked competitor gets named by AI engines in the latest run: the questions it is named for and whether the brand is named there too, what the engines said about it, the other sites cited in those answers, and its own pages that were cited.",
			inputSchema: {
				...projectArg,
				name: EntitySchema.shape.name.describe("The competitor's name as shown by list_competitors."),
			},
			annotations: { readOnlyHint: true },
		},
		async ({ project, name }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const insight = await buildCompetitorInsight(store, found.id, name);
			if (!insight)
				return fail(`"${name}" is not a tracked competitor of ${found.name}. Use list_competitors to see them.`);
			if (!insight.runId) return say(`There is no finished run for ${found.name} yet. Use run_prompts first.`);
			if (insight.named === 0)
				return say(`${insight.name} was not named in any of the ${insight.answers} answers of the latest run.`);
			const position = insight.averageRank === null ? "" : `, average position ${insight.averageRank.toFixed(1)}`;
			return say(
				[
					`${insight.name} was named in ${insight.named} of ${insight.answers} answers${position}.`,
					"",
					"Questions it is named for",
					...insight.questions.map(
						(q) =>
							`  [${q.brandNamed ? `${found.name} named too` : `${found.name} missing`}] ${oneLine(q.question)} (${q.engines.map(engineName).join(", ")})`,
					),
					"",
					"What the engines said about it",
					ANSWER_NOTICE,
					...(insight.quotes.length
						? insight.quotes.map((q) => `> [${engineName(q.engine)}] ${oneLine(q.text)}`)
						: ["  (nothing quoted)"]),
					"",
					"Other sites cited in those answers",
					...(insight.sites.length
						? insight.sites.map(
								(s) => `  ${s.domain}: ${s.citations}${s.namesBrand ? "" : ` (never alongside ${found.name})`}`,
							)
						: ["  (none)"]),
					"",
					"Its own pages the engines cited",
					...(insight.pages.length ? insight.pages.map((p) => `  ${p.url}: ${p.citations}`) : ["  (none)"]),
				].join("\n"),
			);
		},
	);

	server.registerTool(
		"list_competitors",
		{
			description:
				"List the competitors a brand is tracked against, with their websites and, once a run has finished, how often AI engines mention each one and at what average position.",
			inputSchema: projectArg,
			annotations: { readOnlyHint: true },
		},
		async ({ project }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const competitors = await store.competitors.list(found.id);
			if (competitors.length === 0) return say(`No competitors are tracked for ${found.name} yet. ${howToAdd}`);
			const report = await buildReport(store, found.id);
			const partial = report.run?.status === "running" && report.run.id === report.basedOnRunId;
			const stats =
				report.basedOnRunId && !partial
					? new Map(report.competitors.map((c) => [c.name, c]))
					: new Map<string, never>();
			const lines = competitors.map((competitor) => {
				const name = label(competitor.name, competitor.domains[0]);
				const stat = stats.get(competitor.name);
				if (!stat) return name;
				const position = stat.averageRank === null ? "" : `, average position ${stat.averageRank.toFixed(1)}`;
				return `${name}: in ${percent(stat.mentionRate)} of answers${position}`;
			});
			return say(
				[
					`${count(competitors.length, "competitor")} tracked for ${found.name} (${MAX_COMPETITORS} at most)`,
					...lines.map((line) => `  ${line}`),
					"",
					stats.size > 0
						? `Shares are from the latest finished run. ${howToAdd}`
						: `No finished run yet, so there are no shares. ${howToAdd}`,
				].join("\n"),
			);
		},
	);

	if (competitorIdeas)
		server.registerTool(
			"find_competitors",
			{
				description:
					"Ask the user's AI engine (one request, up to a couple of minutes) who a brand's likely competitors are. Returns suggestions only and saves nothing: show them to the user, then call add_competitors with the ones they confirm.",
				inputSchema: projectArg,
				annotations: { readOnlyHint: false, openWorldHint: true },
			},
			async ({ project }) => {
				const found = await resolve(project);
				if (isReply(found)) return found;
				const site = found.domains[0];
				const about = site && describeSite ? await describeSite(site).catch(() => null) : null;
				let ideas: CompetitorIdea[];
				try {
					ideas = await competitorIdeas(await projectCompetitorContext(store, found, about));
				} catch {
					return fail(
						"The AI engine could not suggest competitors. Try again, or add them by name with add_competitors.",
					);
				}
				if (ideas.length === 0)
					return say(
						`No suggestions came back for ${found.name}: no AI engine is ready, or it found nobody new. Add competitors by name with add_competitors.`,
					);
				return say(
					[
						`${count(ideas.length, "suggested competitor")} for ${found.name}. Nothing has been saved.`,
						"Show these to the user, and once they confirm which to track, call add_competitors with those names and websites.",
						"",
						QUOTE_NOTICE,
						...ideas.map((idea) => `> ${label(idea.name, idea.domain)}`),
					].join("\n"),
				);
			},
		);

	server.registerTool(
		"add_competitors",
		{
			description: `Start tracking more competitors for a brand, keeping the ones already tracked (${MAX_COMPETITORS} at most). Skips names already on the list and the brand itself. New competitors are counted from the next run.`,
			inputSchema: {
				...projectArg,
				competitors: z
					.array(
						z.object({
							name: EntitySchema.shape.name.describe("The competitor's name as AI engines would write it."),
							website: z
								.string()
								.trim()
								.max(MAX_ENTITY_TEXT)
								.optional()
								.describe("Its website, for example `hubspot.com`. Optional."),
						}),
					)
					.min(1)
					.max(20)
					.describe("The competitors to add."),
			},
			annotations: { readOnlyHint: false },
		},
		async ({ project, competitors }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const existing = await store.competitors.list(found.id);
			const own = new Set([found.name, ...found.aliases].map(sameText));
			const tracked = new Set(existing.flatMap((c) => [c.name, ...c.aliases]).map(sameText));
			const added: EntityInput[] = [];
			const skipped: string[] = [];
			for (const { name, website } of competitors) {
				const key = sameText(name);
				const reason = own.has(key)
					? "that is the brand itself"
					: tracked.has(key)
						? "already tracked"
						: existing.length + added.length >= MAX_COMPETITORS
							? `the list is full (${MAX_COMPETITORS} at most)`
							: null;
				if (reason) {
					skipped.push(`  ${oneLine(name)}: ${reason}`);
					continue;
				}
				tracked.add(key);
				const domain = website ? websiteDomain(website) : null;
				added.push({ name, aliases: [], domains: domain ? [domain] : [] });
			}
			if (added.length === 0) return fail([`Nothing was added to ${found.name}.`, "Skipped", ...skipped].join("\n"));
			await store.competitors.replace(found.id, [
				...existing.map(({ name, aliases, domains }) => ({ name, aliases, domains })),
				...added,
			]);
			return say(
				[
					`Added ${count(added.length, "competitor")} to ${found.name}: ${added.map((c) => label(c.name, c.domains[0])).join(", ")}.`,
					...(skipped.length > 0 ? ["Skipped", ...skipped] : []),
					NEXT_RUN,
				].join("\n"),
			);
		},
	);

	server.registerTool(
		"remove_competitor",
		{
			description:
				"Stop tracking one competitor of a brand, by name. Past runs keep their answers, but the competitor no longer appears in reports. Confirm with the user first.",
			inputSchema: {
				...projectArg,
				name: EntitySchema.shape.name.describe("The competitor's name as shown by list_competitors."),
			},
			annotations: { readOnlyHint: false, destructiveHint: true },
		},
		async ({ project, name }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const existing = await store.competitors.list(found.id);
			const target = existing.find((c) => sameText(c.name) === sameText(name));
			if (!target)
				return fail(
					`There is no competitor named "${oneLine(name)}" for ${found.name}. Competitors: ${
						existing.map((c) => oneLine(c.name)).join(", ") || "none"
					}.`,
				);
			await store.competitors.replace(
				found.id,
				existing.filter((c) => c !== target).map(({ name, aliases, domains }) => ({ name, aliases, domains })),
			);
			return say(`Removed ${oneLine(target.name)} from the competitors of ${found.name}.`);
		},
	);
}
