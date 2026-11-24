import { sameSite, toDomain } from "@openaeo/engine";
import type { Store } from "./store/store";

export type Opportunities = {
	runId: string | null;
	missed: { question: string; engines: string[]; named: string[] }[];
	sites: { domain: string; citations: number; questions: number }[];
	fixes: { title: string; severity: string; pages: number }[];
};

const SEVERITY_ORDER = ["high", "medium", "low"];
const sitesOf = (domains: string[]) => domains.map((d) => toDomain(/^https?:\/\//i.test(d) ? d : `https://${d}`)).filter((d): d is string => d !== null);

export function buildOpportunities(store: Store, projectId: string): Opportunities {
	const project = store.projects.get(projectId);
	const run = store.runs.list(projectId, 10).find((r) => r.status !== "running") ?? null;
	const fixes = auditFixes(store, projectId);
	if (!project || !run) return { runId: null, missed: [], sites: [], fixes };

	const names = new Set([project.name, ...project.aliases].map((n) => n.toLowerCase()));
	const texts = new Map(store.prompts.list(projectId).map((p) => [p.id, p.text]));
	const answers = store.answers.listByRun(run.id).filter((a) => a.errorCode === null);

	const missed = new Map<string, { engines: Set<string>; named: Set<string> }>();
	for (const answer of answers) {
		if (answer.brandRank !== null) continue;
		const others = answer.mentions.map((m) => m.entity).filter((entity) => !names.has(entity.toLowerCase()));
		if (others.length === 0) continue;
		const question = texts.get(answer.promptId);
		if (!question) continue;
		const entry = missed.get(question) ?? { engines: new Set<string>(), named: new Set<string>() };
		entry.engines.add(answer.engine);
		for (const other of others) entry.named.add(other);
		missed.set(question, entry);
	}

	const known = [...sitesOf(project.domains), ...store.competitors.list(projectId).flatMap((c) => sitesOf(c.domains))];
	const cited = new Map<string, { citations: number; questions: Set<string> }>();
	for (const answer of answers) {
		for (const citation of answer.citations) {
			if (known.some((site) => sameSite(citation.domain, site))) continue;
			const entry = cited.get(citation.domain) ?? { citations: 0, questions: new Set<string>() };
			entry.citations += 1;
			entry.questions.add(answer.promptId);
			cited.set(citation.domain, entry);
		}
	}

	return {
		runId: run.id,
		missed: [...missed.entries()].map(([question, entry]) => ({ question, engines: [...entry.engines].sort(), named: [...entry.named] })).sort((a, b) => b.engines.length - a.engines.length || a.question.localeCompare(b.question)),
		sites: [...cited.entries()]
			.map(([domain, entry]) => ({ domain, citations: entry.citations, questions: entry.questions.size }))
			.sort((a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain))
			.slice(0, 25),
		fixes,
	};
}

function auditFixes(store: Store, projectId: string): Opportunities["fixes"] {
	const audit = store.audits.latest(projectId, { ownOnly: true });
	if (!audit || audit.status !== "done") return [];
	const groups = new Map<string, { severity: string; pages: number }>();
	for (const finding of store.audits.findings(audit.id)) groups.set(finding.title, { severity: finding.severity, pages: (groups.get(finding.title)?.pages ?? 0) + 1 });
	return [...groups.entries()]
		.map(([title, info]) => ({ title, ...info }))
		.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.pages - a.pages);
}
