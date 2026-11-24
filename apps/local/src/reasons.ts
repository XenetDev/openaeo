import type { ReasonView } from "./api-types";
import { buildOpportunities } from "./opportunities";
import { buildReport } from "./report";
import type { Store } from "./store/store";

const unique = (values: string[]) => [...new Set(values)];
const engines = (count: number) => (count === 1 ? "1 engine" : `${count} engines`);

export function buildReasons(store: Store, projectId: string): ReasonView[] {
	const project = store.projects.get(projectId);
	const finished = store.runs.list(projectId, 10).find((run) => run.status !== "running");
	if (!project || !finished) return [];
	const report = buildReport(store, projectId, { runId: finished.id });
	const { metrics } = report.overall;
	const checks = report.brand;
	const reasons: ReasonView[] = [];

	const strangers = checks.filter((check) => check.knows === "no");
	if (strangers.length > 0)
		reasons.push({
			id: "unknown",
			severity: "high",
			title: `${engines(strangers.length)} could not say what ${project.name} is`,
			detail: `Asked about ${project.name} by name, ${strangers.map((check) => check.engine).join(" and ")} could not identify it. An engine that does not know a company cannot recommend it.`,
			action:
				"Get listed where engines look first: a complete profile on G2, Clutch, Crunchbase and LinkedIn, and a clear About page that states what you do in the first sentence.",
			evidence: [],
		});

	if (metrics.answers > 0 && metrics.mentionRate < 0.25) {
		const leader = report.competitors.find((competitor) => !competitor.isBrand && competitor.mentionRate > 0);
		reasons.push({
			id: "not-recommended",
			severity: "high",
			title: `${project.name} is rarely named when buyers ask`,
			detail: `Named in ${Math.round(metrics.mentionRate * metrics.answers)} of ${metrics.answers} answers to the questions you track${leader ? `. ${leader.name} was named most` : ""}. Engines recommend the companies that the sources they trust mention for that topic.`,
			action:
				"Open Opportunities to see who was named for each question and which sites those answers relied on, then work on being mentioned there.",
			evidence: leader ? [leader.name] : [],
		});
	}

	const concerns = unique(checks.flatMap((check) => check.concerns));
	if (concerns.length > 0)
		reasons.push({
			id: "concerns",
			severity: "high",
			title: "Engines found conflicting or unverified facts about you",
			detail:
				"These came up when the engines were asked about you by name. An engine that is unsure about a company describes it with warnings, or leaves it out.",
			action:
				"Make the facts agree everywhere: your own site, LinkedIn and every directory profile. Correct or remove the source that is wrong.",
			evidence: concerns,
		});

	const described = checks.filter((check) => check.knows !== "no" && check.sources.length > 0);
	const blind = described.filter((check) => !check.ownSiteUsed);
	if (blind.length > 0)
		reasons.push({
			id: "own-site-unused",
			severity: "medium",
			title: "Engines describe you from other sites, not your own",
			detail: `${engines(blind.length)} described ${project.name} without using your website. What these sites say is what AI repeats about you.`,
			action:
				"Check each of these profiles is accurate and complete, and make your own About and product pages state the same facts plainly so engines can cite them.",
			evidence: unique(blind.flatMap((check) => check.sources)).slice(0, 8),
		});

	const sites = buildOpportunities(store, projectId).sites.slice(0, 5);
	if (metrics.answers > 0 && metrics.mentionRate < 0.5 && sites.length > 0)
		reasons.push({
			id: "missing-from-sources",
			severity: "medium",
			title: "You are not on the sites these answers rely on",
			detail:
				"These are the sites the engines cited most when answering your tracked questions. None belongs to you or a competitor you track.",
			action:
				"Aim to be mentioned or listed on them: a guest article, a directory entry, a comparison, or a correction where you are missing.",
			evidence: sites.map((site) => site.domain),
		});

	const confused = unique(checks.flatMap((check) => check.confusedWith));
	if (confused.length > 0)
		reasons.push({
			id: "confused",
			severity: "low",
			title: `Engines can mix ${project.name} up with other names`,
			detail: "Similar names make an engine less certain which company a source is about.",
			action:
				"Use one exact name everywhere, and add Organization structured data to your home page with sameAs links to your official profiles.",
			evidence: confused,
		});

	return reasons;
}
