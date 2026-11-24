import type { PlanStepView, PlanView } from "./api-types";
import { buildOpportunities } from "./opportunities";
import { buildReport, promptStats } from "./report";
import type { Store } from "./store/store";

type Step = Omit<PlanStepView, "done">;

const MAX_ITEMS = 5;
const unique = (values: string[]) => [...new Set(values)];
const engines = (count: number) => (count === 1 ? "1 engine" : `${count} engines`);
const link = (domain: string) => ({ label: domain, url: `https://${domain}` });
const doneKey = (projectId: string) => `plan.done.${projectId}`;

function doneSteps(store: Store, projectId: string): string[] {
	try {
		const parsed: unknown = JSON.parse(store.settings.get(doneKey(projectId)) ?? "[]");
		return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
	} catch {
		return [];
	}
}

export function setStepDone(store: Store, projectId: string, stepId: string, done: boolean): void {
	const current = doneSteps(store, projectId).filter((id) => id !== stepId);
	store.settings.set(doneKey(projectId), JSON.stringify(done ? [...current, stepId] : current));
}

export function forgetPlan(store: Store, projectId: string): void {
	store.settings.remove(doneKey(projectId));
}

function buildSteps(store: Store, projectId: string): Step[] {
	const project = store.projects.get(projectId);
	const finished = store.runs.list(projectId, 10).find((run) => run.status !== "running");
	if (!project || !finished) return [];
	const name = project.name;
	const report = buildReport(store, projectId, { runId: finished.id });
	const { metrics } = report.overall;
	const checks = report.brand;
	const found = buildOpportunities(store, projectId);
	const steps: Step[] = [];

	const strangers = checks.filter((check) => check.knows === "no");
	if (strangers.length > 0)
		steps.push({
			id: "unknown",
			severity: "high",
			title: `Make sure AI can find out what ${name} is`,
			why: `Asked about ${name} by name, ${strangers.map((check) => check.engine).join(" and ")} could not identify it. An engine that does not know a company cannot recommend it.`,
			how: [
				"Create or complete your company profile on LinkedIn, Crunchbase, G2 and Clutch, with the same one-line description on each.",
				"Make the first sentence of your home page and About page say plainly what you do and who it is for.",
				"Run again in a few days and check this step's engines now know you.",
			],
			evidence: [],
			links: [],
			ask: `Write a one-sentence description of ${name} that I can use on every profile, and a short About page that states what we do, who it is for and where we are based.`,
			page: null,
		});

	const concerns = unique(checks.flatMap((check) => check.concerns));
	if (concerns.length > 0)
		steps.push({
			id: "facts",
			severity: "high",
			title: "Fix the facts AI is unsure about",
			why: "These doubts came up when the engines were asked about you by name. An engine that is unsure about a company describes it with warnings, or leaves it out.",
			how: [
				"For each point above, decide what is true.",
				"State it clearly on your own site, then correct every profile or listing that says something different.",
				"Where a claim is only your word, add proof AI can read: a case study page, a named customer quote, or a link to the award or partner listing.",
			],
			evidence: concerns,
			links: unique(checks.flatMap((check) => check.sources))
				.slice(0, MAX_ITEMS)
				.map(link),
			ask: `AI engines raised these doubts about ${name}: ${concerns.join("; ")}. For each one, tell me what to change and where, in order of importance.`,
			page: null,
		});

	const unnamed = promptStats(store, projectId)
		.filter((stat) => stat.active && stat.latest === 0)
		.map((stat) => stat.text);
	if (unnamed.length > 0) {
		const leader = report.competitors.find((competitor) => !competitor.isBrand && competitor.mentionRate > 0);
		steps.push({
			id: "questions",
			severity: metrics.mentionRate < 0.25 ? "high" : "medium",
			title: "Publish a direct answer to each question you are missing from",
			why: `No engine named ${name} for ${unnamed.length === 1 ? "this question" : `these ${unnamed.length} questions`}${leader ? `, while ${leader.name} was named most overall` : ""}. Engines quote pages that answer the question directly.`,
			how: [
				"Give each question its own page, or its own section with the question as the heading.",
				"Answer it in the first two sentences, then add the detail: who it is for, what it costs, how you compare.",
				"Link the page from your home page and include it in your sitemap.",
				"Open Answers to read what the engines said, and cover what they covered.",
			],
			evidence: unnamed.slice(0, MAX_ITEMS),
			links: [],
			ask: `Write an outline for a page on ${project.domains[0] ?? "my site"} that directly answers this buyer question and would make an AI engine name ${name}: "${unnamed[0]}"`,
			page: "answers",
		});
	}

	const blind = checks.filter((check) => check.knows !== "no" && check.sources.length > 0 && !check.ownSiteUsed);
	if (blind.length > 0)
		steps.push({
			id: "profiles",
			severity: "medium",
			title: "Check the profiles AI uses to describe you",
			why: `${engines(blind.length)} described ${name} from these sites without using your own. What they say is what AI repeats about you.`,
			how: [
				"Open each one and check the description, team size, location and services are right and match each other.",
				"Claim any profile you do not control, and fill in the empty fields.",
				"Put the same facts on your own About page so engines can cite you directly.",
			],
			evidence: [],
			links: unique(blind.flatMap((check) => check.sources))
				.slice(0, 8)
				.map(link),
			ask: null,
			page: null,
		});

	const sites = found.sites.slice(0, MAX_ITEMS);
	if (metrics.answers > 0 && metrics.mentionRate < 0.5 && sites.length > 0)
		steps.push({
			id: "sources",
			severity: "medium",
			title: "Get mentioned on the sites these answers rely on",
			why: "The engines cited these sites most when answering your tracked questions, and none of them mentions you. Being named there is the most direct way into the answers.",
			how: [
				"Open each site and find the page that covers your category.",
				"If it is a list or directory, ask to be added. If it is an article, offer the author a short, factual paragraph about what you do.",
				"Start with the site cited most.",
			],
			evidence: [],
			links: sites.map((site) => link(site.domain)),
			ask: `Draft a short, polite message asking the editor of ${sites[0]?.domain} to include ${name} where they cover our category. Keep it factual.`,
			page: "sources",
		});

	const confused = unique(checks.flatMap((check) => check.confusedWith));
	if (confused.length > 0)
		steps.push({
			id: "identity",
			severity: "low",
			title: `Help AI tell ${name} apart from similar names`,
			why: "The engines warned that these names could be confused with yours. That makes them less sure which company a source is about.",
			how: [
				"Use one exact company name everywhere, including the legal suffix if you use one.",
				"Add Organization structured data to your home page with sameAs links to your LinkedIn, Crunchbase and other official profiles.",
				"Say where you are based and what you do in the first line of each profile.",
			],
			evidence: confused,
			links: [],
			ask: `Write Organization JSON-LD for ${name} at ${project.domains[0] ?? "our website"} with sameAs links, and tell me where to put it.`,
			page: null,
		});

	if (found.fixes.length > 0)
		steps.push({
			id: "website",
			severity: found.fixes.some((fix) => fix.severity === "high") ? "high" : "low",
			title: `Fix ${found.fixes.length === 1 ? "the problem" : `the ${found.fixes.length} problems`} the audit found on your site`,
			why: "These stop AI crawlers reading or quoting your pages.",
			how: [
				"Open the Audit page and copy the fix brief.",
				"Paste it into Claude Code or Codex inside your website's code, and review the changes it makes.",
			],
			evidence: found.fixes.map((fix) => fix.title).slice(0, MAX_ITEMS),
			links: [],
			ask: null,
			page: "audit",
		});

	return steps;
}

export function buildPlan(store: Store, projectId: string): PlanView {
	const done = new Set(doneSteps(store, projectId));
	const steps = buildSteps(store, projectId).map((step) => ({ ...step, done: done.has(step.id) }));
	return { steps, done: steps.filter((step) => step.done).length };
}
