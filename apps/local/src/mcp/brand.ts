import { websiteDomain } from "../competitor-ideas";
import { cleanLocation } from "../location";
import { createProject } from "../projects";
import { EntitySchema, LocationSchema, NamesSchema } from "../server/schemas";
import type { Project } from "../store/types";
import { count, fail, isReply, type McpContext, type McpLimits, oneLine, projectArg, sameText, say } from "./shared";

const websitesArg = NamesSchema.describe(
	"The brand's own websites, for example `acme.com`. A link to one counts as the brand being cited. Replaces the current list.",
);
const namesArg = NamesSchema.describe(
	"Other names that also count as a mention: short forms and product names. Replaces the current list.",
);
const locationArg = LocationSchema.describe(
	"Where the brand's buyers are, for example `London, United Kingdom`. Every question is asked as if from there. An empty string clears it.",
);

function toDomains(websites: string[]): string[] | string {
	const domains: string[] = [];
	for (const website of websites) {
		if (!website.trim()) continue;
		const domain = websiteDomain(website);
		if (!domain?.includes(".") || /\s/.test(website.trim()))
			return `"${oneLine(website).slice(0, 100)}" is not a website address. Give a domain such as acme.com.`;
		if (!domains.includes(domain)) domains.push(domain);
	}
	return domains;
}

const facts = (project: Project) => [
	`  Websites: ${project.domains.map(oneLine).join(", ") || "none"}`,
	`  Other names: ${project.aliases.map(oneLine).join(", ") || "none"}`,
	`  Location: ${project.location ? oneLine(project.location) : "not set"}`,
];

export function registerBrandTools({ server, store, resolve, words }: McpContext, limits: McpLimits = {}): void {
	server.registerTool(
		"list_projects",
		{
			description: words.listProjects,
			annotations: { readOnlyHint: true },
		},
		async () => {
			const projects = await store.projects.list();
			if (projects.length === 0) return say(words.noProjectYet);
			const blocks = await Promise.all(
				projects.map(async (p) => {
					const active = (await store.prompts.list(p.id)).filter((q) => q.active).length;
					const run = await store.runs.latest(p.id);
					const audit = await store.audits.latest(p.id);
					const competitors = await store.competitors.list(p.id);
					return [
						`${p.name}${p.domains.length ? ` (${p.domains.join(", ")})` : ""}`,
						`  ${active} active ${active === 1 ? "question" : "questions"}; competitors: ${
							competitors.map((c) => c.name).join(", ") || "none"
						}`,
						`  Latest run: ${run ? `${run.status}, ${new Date(run.startedAt).toISOString().slice(0, 16)}` : "no runs yet"}`,
						`  Latest audit: ${audit ? `${audit.status}${audit.score === null ? "" : `, score ${audit.score}/100`}` : "no audit yet"}`,
					].join("\n");
				}),
			);
			return say(blocks.join("\n\n"));
		},
	);

	server.registerTool(
		"get_brand",
		{
			description:
				"Get a brand's settings: its name, its own websites, the other names that count as a mention, and the location its questions are asked from.",
			inputSchema: projectArg,
			annotations: { readOnlyHint: true },
		},
		async ({ project }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const prompts = await store.prompts.list(found.id);
			const competitors = await store.competitors.list(found.id);
			return say(
				[
					found.name,
					...facts(found),
					`  Tracking ${count(prompts.length, "question")} (${prompts.filter((p) => p.active).length} active) and ${count(competitors.length, "competitor")}`,
					"",
					"Use update_brand to change the websites, other names or location.",
				].join("\n"),
			);
		},
	);

	server.registerTool(
		"update_brand",
		{
			description:
				"Change a brand's settings: its location, its own websites, the other names that count as a mention, or its name. Only the fields given are changed, and a list replaces the whole current list. Changes apply from the next run; past runs are not recounted.",
			inputSchema: {
				...projectArg,
				name: EntitySchema.shape.name.optional().describe("A new name for the brand, as AI engines would write it."),
				websites: websitesArg.optional(),
				other_names: namesArg.optional(),
				location: locationArg.optional(),
			},
			annotations: { readOnlyHint: false },
		},
		async ({ project, name, websites, other_names, location }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			if (name === undefined && !websites && !other_names && location === undefined)
				return fail("Nothing to change: give a name, websites, other_names or location.");
			if (name && sameText(name) !== sameText(found.name)) {
				const taken = (await store.projects.list()).some(
					(p) => p.id !== found.id && sameText(p.name) === sameText(name),
				);
				if (taken) return fail(`Another brand is already called "${oneLine(name)}". Choose a different name.`);
			}
			const domains = websites ? toDomains(websites) : found.domains;
			if (typeof domains === "string") return fail(domains);
			const updated = await store.projects.update(found.id, {
				name: name ?? found.name,
				aliases: other_names ?? found.aliases,
				domains,
				location: location === undefined ? found.location : cleanLocation(location),
			});
			if (!updated) return fail(`${found.name} could not be found any more. Use list_projects to see the brands.`);
			return say(
				[
					`Updated ${updated.name}`,
					...facts(updated),
					"Changes apply from the next run; use run_prompts to start one.",
				].join("\n"),
			);
		},
	);

	server.registerTool(
		"create_brand",
		{
			description:
				"Start tracking a new brand: its name, and optionally its websites, other names and location. Nothing is asked of any AI engine yet. Afterwards add what buyers ask with add_questions and who it competes with using add_competitors, then start its first run with run_prompts. Confirm the details with the user first.",
			inputSchema: {
				name: EntitySchema.shape.name.describe("The brand's name, as AI engines would write it."),
				websites: websitesArg.optional(),
				other_names: namesArg.optional(),
				location: locationArg.optional(),
			},
			annotations: { readOnlyHint: false },
		},
		async ({ name, websites, other_names, location }) => {
			const refusal = await limits.brands?.();
			if (refusal) return fail(refusal);
			if ((await store.projects.list()).some((p) => sameText(p.name) === sameText(name)))
				return fail(`A brand called "${oneLine(name)}" is already tracked. Use update_brand to change it.`);
			const domains = toDomains(websites ?? []);
			if (typeof domains === "string") return fail(domains);
			const created = await createProject(store, {
				name,
				aliases: other_names ?? [],
				domains,
				location,
				competitors: [],
				prompts: [],
			});
			return say(
				[
					`Created ${created.name}`,
					...facts(created),
					`Next: add the questions buyers ask with add_questions and its competitors with add_competitors, passing project "${oneLine(created.name)}". Then start its first run with run_prompts.`,
				].join("\n"),
			);
		},
	);
}
