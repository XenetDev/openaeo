import {
	type EngineId,
	type MatchResult,
	type Metrics,
	metrics,
	sameSite,
	toDomain,
	visibility,
} from "@openaeo/engine";
import type { BrandCheckView, PromptStatView } from "./api-types";
import type { Project, Run, Store, StoredAnswer } from "./store/types";

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
	brand: BrandCheckView[];
};

export type CitedSite = {
	domain: string;
	citations: number;
	isBrand: boolean;
	engines: EngineId[];
	questions: number;
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

export function citedSites(answers: StoredAnswer[], sites: string[]): CitedSite[] {
	const found = new Map<string, { citations: number; engines: Set<EngineId>; questions: Set<string> }>();
	for (const answer of answers) {
		for (const citation of answer.citations) {
			const entry = found.get(citation.domain) ?? { citations: 0, engines: new Set(), questions: new Set() };
			entry.citations += 1;
			entry.engines.add(answer.engine);
			entry.questions.add(answer.promptId);
			found.set(citation.domain, entry);
		}
	}
	return [...found.entries()]
		.map(([domain, entry]) => ({
			domain,
			citations: entry.citations,
			isBrand: sites.some((site) => sameSite(domain, site)),
			engines: [...entry.engines].sort(),
			questions: entry.questions.size,
		}))
		.sort((a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain));
}

async function taggedPrompts(store: Store, projectId: string, tag: string | undefined): Promise<Set<string> | null> {
	const wanted = tag?.trim().toLowerCase();
	if (!wanted) return null;
	return new Set(
		(await store.prompts.list(projectId))
			.filter((prompt) => prompt.tags.some((candidate) => candidate.toLowerCase() === wanted))
			.map((prompt) => prompt.id),
	);
}

async function settled(store: Store, projectId: string, run: Run | null): Promise<Run | null> {
	if (run?.status !== "running") return run;
	return (await store.runs.list(projectId, 30)).find((r) => r.status !== "running") ?? run;
}

export async function buildSources(
	store: Store,
	projectId: string,
	opts: { tag?: string } = {},
): Promise<{ run: Run | null; sites: CitedSite[] }> {
	const project = await store.projects.get(projectId);
	const run = await settled(store, projectId, (await store.runs.latest(projectId)) ?? null);
	if (!project || !run) return { run: null, sites: [] };
	const tagged = await taggedPrompts(store, projectId, opts.tag);
	const answers = ok(await store.answers.listByRun(run.id)).filter((a) => !tagged || tagged.has(a.promptId));
	return { run, sites: citedSites(answers, brandSites(project)) };
}

export async function buildReport(
	store: Store,
	projectId: string,
	opts: { runId?: string; trendRuns?: number; tag?: string } = {},
): Promise<Report> {
	const project = await store.projects.get(projectId);
	const run = (opts.runId ? await store.runs.get(opts.runId) : await store.runs.latest(projectId)) ?? null;
	const tagged = await taggedPrompts(store, projectId, opts.tag);
	const answersOf = async (runId: string) => {
		const all = await store.answers.listByRun(runId);
		return tagged ? all.filter((answer) => tagged.has(answer.promptId)) : all;
	};
	const source = opts.runId ? run : await settled(store, projectId, run);
	const answers = source && source.projectId === projectId ? await answersOf(source.id) : [];
	const good = ok(answers);

	const engineIds = [...new Set(answers.map((a) => a.engine))];
	const engines = engineIds.map((engine) => {
		const mine = answers.filter((a) => a.engine === engine);
		return { engine, ...summarise(mine), errors: mine.length - ok(mine).length };
	});

	const names = project ? [project.name, ...(await store.competitors.list(projectId)).map((c) => c.name)] : [];
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

	const topDomains = citedSites(good, project ? brandSites(project) : [])
		.slice(0, 25)
		.map(({ domain, citations, isBrand }) => ({ domain, citations, isBrand }));

	const trend = await Promise.all(
		(await store.runs.list(projectId, opts.trendRuns ?? 30))
			.filter((r) => r.status !== "running")
			.reverse()
			.map(async (r) => {
				const summary = summarise(await answersOf(r.id));
				return {
					runId: r.id,
					startedAt: r.startedAt,
					visibility: summary.visibility,
					mentionRate: summary.metrics.mentionRate,
					citationRate: summary.metrics.citationRate,
					averageRank: summary.metrics.averageRank,
					sentiment: summary.sentiment.score,
				};
			}),
	);

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
		brand: source ? (await store.brandChecks.listByRun(source.id)).map(({ text: _text, ...check }) => check) : [],
	};
}

export type PromptStat = PromptStatView;

export async function promptStats(store: Store, projectId: string, maxRuns = 12): Promise<PromptStat[]> {
	const runs = (await store.runs.list(projectId, maxRuns)).filter((r) => r.status !== "running").reverse();
	const perRun = await Promise.all(
		runs.map(async (run) => ({ run, answers: ok(await store.answers.listByRun(run.id)) })),
	);
	return (await store.prompts.list(projectId)).map((prompt) => {
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
