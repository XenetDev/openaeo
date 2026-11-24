import {
	type EngineId,
	type MatchResult,
	type Metrics,
	metrics,
	sameSite,
	toDomain,
	visibility,
} from "@openaeo/engine";
import type { PromptStatView } from "./api-types";
import type { Project, Run, Store, StoredAnswer } from "./store/store";

export type Sentiment = { score: number | null; positive: number; neutral: number; negative: number };
export type EngineReport = {
	engine: EngineId;
	metrics: Metrics;
	visibility: number;
	sentiment: Sentiment;
	errors: number;
};

export type Report = {
	projectId: string;
	run: Run | null;
	basedOnRunId: string | null;
	overall: { metrics: Metrics; visibility: number; sentiment: Sentiment };
	engines: EngineReport[];
	competitors: { name: string; mentionRate: number; averageRank: number | null; isBrand: boolean }[];
	topDomains: { domain: string; citations: number; isBrand: boolean }[];
	trend: {
		runId: string;
		startedAt: number;
		visibility: number;
		mentionRate: number;
		citationRate: number;
		averageRank: number | null;
		sentiment: number | null;
	}[];
	problems: { engine: EngineId; message: string; count: number }[];
};

const ok = (answers: StoredAnswer[]) => answers.filter((a) => a.errorCode === null);

const toMatch = (a: StoredAnswer): MatchResult => ({
	mentions: a.mentions,
	brandMentioned: a.brandRank !== null,
	brandRank: a.brandRank,
	brandCited: a.brandCited,
	brandSourced: a.brandSourced,
	citedDomains: [...new Set(a.citations.map((c) => c.domain))],
});

export function sentimentOf(answers: StoredAnswer[]): Sentiment {
	const count = (label: StoredAnswer["sentiment"]) => answers.filter((a) => a.sentiment === label).length;
	const positive = count("positive");
	const neutral = count("neutral");
	const negative = count("negative");
	const labelled = positive + neutral + negative;
	const score = labelled ? Math.round(((positive + neutral / 2) / labelled) * 100) : null;
	return { score, positive, neutral, negative };
}

function summarise(answers: StoredAnswer[]) {
	const good = ok(answers);
	const m = metrics(good.map(toMatch));
	return { metrics: m, visibility: visibility(m), sentiment: sentimentOf(good) };
}

function brandSites(project: Project): string[] {
	return project.domains
		.map((d) => toDomain(/^https?:\/\//i.test(d) ? d : `https://${d}`))
		.filter((d): d is string => d !== null);
}

export function buildReport(
	store: Store,
	projectId: string,
	opts: { runId?: string; trendRuns?: number; tag?: string } = {},
): Report {
	const project = store.projects.get(projectId);
	const run = (opts.runId ? store.runs.get(opts.runId) : store.runs.latest(projectId)) ?? null;
	const wanted = opts.tag?.trim().toLowerCase();
	const tagged = wanted
		? new Set(
				store.prompts
					.list(projectId)
					.filter((prompt) => prompt.tags.some((tag) => tag.toLowerCase() === wanted))
					.map((prompt) => prompt.id),
			)
		: null;
	const answersOf = (runId: string) => {
		const all = store.answers.listByRun(runId);
		return tagged ? all.filter((answer) => tagged.has(answer.promptId)) : all;
	};
	const finished =
		run?.status === "running" && !opts.runId
			? store.runs.list(projectId, 30).find((r) => r.status !== "running")
			: undefined;
	const source = finished ?? run;
	const answers = source && source.projectId === projectId ? answersOf(source.id) : [];
	const good = ok(answers);

	const engineIds = [...new Set(answers.map((a) => a.engine))];
	const engines = engineIds.map((engine) => {
		const mine = answers.filter((a) => a.engine === engine);
		return { engine, ...summarise(mine), errors: mine.length - ok(mine).length };
	});

	const names = project ? [project.name, ...store.competitors.list(projectId).map((c) => c.name)] : [];
	const competitors = names
		.map((name, index) => {
			const ranks = good.flatMap((a) => a.mentions.filter((m) => m.entity === name).map((m) => m.rank));
			return {
				name,
				mentionRate: good.length ? ranks.length / good.length : 0,
				averageRank: ranks.length ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length : null,
				isBrand: index === 0,
			};
		})
		.sort((a, b) => b.mentionRate - a.mentionRate);

	const sites = project ? brandSites(project) : [];
	const counts = new Map<string, number>();
	for (const answer of good) {
		for (const citation of answer.citations) counts.set(citation.domain, (counts.get(citation.domain) ?? 0) + 1);
	}
	const topDomains = [...counts.entries()]
		.map(([domain, citations]) => ({ domain, citations, isBrand: sites.some((site) => sameSite(domain, site)) }))
		.sort((a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain))
		.slice(0, 25);

	const trend = store.runs
		.list(projectId, opts.trendRuns ?? 30)
		.filter((r) => r.status !== "running")
		.reverse()
		.map((r) => {
			const summary = summarise(answersOf(r.id));
			return {
				runId: r.id,
				startedAt: r.startedAt,
				visibility: summary.visibility,
				mentionRate: summary.metrics.mentionRate,
				citationRate: summary.metrics.citationRate,
				averageRank: summary.metrics.averageRank,
				sentiment: summary.sentiment.score,
			};
		});

	const problems: Report["problems"] = [];
	for (const answer of answers) {
		if (answer.errorCode === null) continue;
		const message = answer.errorMessage ?? answer.errorCode;
		const existing = problems.find((p) => p.engine === answer.engine && p.message === message);
		if (existing) existing.count += 1;
		else problems.push({ engine: answer.engine, message, count: 1 });
	}

	return {
		projectId,
		run: answers.length || run ? run : null,
		basedOnRunId: source?.id ?? null,
		overall: summarise(answers),
		engines,
		competitors,
		topDomains,
		trend,
		problems,
	};
}

export type PromptStat = PromptStatView;

export function promptStats(store: Store, projectId: string, maxRuns = 12): PromptStat[] {
	const runs = store.runs
		.list(projectId, maxRuns)
		.filter((r) => r.status !== "running")
		.reverse();
	const perRun = runs.map((run) => ({ run, answers: ok(store.answers.listByRun(run.id)) }));
	return store.prompts.list(projectId).map((prompt) => {
		const history: PromptStat["history"] = [];
		let bestRank: number | null = null;
		for (const { run, answers } of perRun) {
			const mine = answers.filter((a) => a.promptId === prompt.id);
			if (mine.length === 0) continue;
			const mentioned = mine.filter((a) => a.brandRank !== null);
			history.push({ runId: run.id, startedAt: run.startedAt, rate: mentioned.length / mine.length });
			for (const answer of mentioned)
				bestRank = bestRank === null ? answer.brandRank : Math.min(bestRank, answer.brandRank ?? bestRank);
		}
		return {
			promptId: prompt.id,
			text: prompt.text,
			active: prompt.active,
			history,
			latest: history.at(-1)?.rate ?? null,
			previous: history.at(-2)?.rate ?? null,
			bestRank,
		};
	});
}
