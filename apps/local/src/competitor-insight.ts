import { sameSite, toDomain } from "@openaeo/engine";
import type { CompetitorInsightView } from "./api-types";
import type { Store } from "./store/types";

export type CompetitorInsight = CompetitorInsightView;

const MAX_QUOTES = 6;
const MAX_SITES = 12;
const MAX_PAGES = 10;
const QUOTE_LENGTH = 320;

const sitesOf = (domains: string[]) =>
	domains.map((d) => toDomain(/^https?:\/\//i.test(d) ? d : `https://${d}`)).filter((d): d is string => d !== null);

const plain = (text: string) =>
	text
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/[*_`#>]+/g, "")
		.replace(/\s+/g, " ")
		.trim();

function quoteOf(text: string, names: string[]): string | null {
	const sentences = text
		.split(/\n+/)
		.flatMap((line) => plain(line.replace(/^\s*[-•\d.]+\s+/, "")).split(/(?<=[.!?])\s+/))
		.filter(Boolean);
	const hit = sentences.find((sentence) => names.some((name) => sentence.toLowerCase().includes(name)));
	if (!hit) return null;
	return hit.length > QUOTE_LENGTH ? `${hit.slice(0, QUOTE_LENGTH).trimEnd()}…` : hit;
}

export async function buildCompetitorInsight(
	store: Store,
	projectId: string,
	name: string,
): Promise<CompetitorInsight | null> {
	const project = await store.projects.get(projectId);
	if (!project) return null;
	const competitors = await store.competitors.list(projectId);
	const competitor = competitors.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
	if (!competitor) return null;

	const empty: CompetitorInsight = {
		name: competitor.name,
		runId: null,
		answers: 0,
		named: 0,
		averageRank: null,
		questions: [],
		quotes: [],
		sites: [],
		pages: [],
	};
	const run = (await store.runs.list(projectId, 10)).find((r) => r.status !== "running") ?? null;
	if (!run) return empty;

	const names = [competitor.name, ...competitor.aliases].map((n) => n.toLowerCase());
	const own = sitesOf(competitor.domains);
	const known = [
		...sitesOf(project.domains),
		...competitors.filter((c) => c !== competitor).flatMap((c) => sitesOf(c.domains)),
	];
	const texts = new Map((await store.prompts.list(projectId)).map((p) => [p.id, p.text]));
	const answers = (await store.answers.listByRun(run.id)).filter((a) => a.errorCode === null);

	const questions = new Map<string, { engines: Set<string>; brandNamed: boolean }>();
	const quotes: CompetitorInsight["quotes"] = [];
	const sites = new Map<string, { citations: number; namesBrand: boolean }>();
	const pages = new Map<string, { title: string | null; citations: number }>();
	const ranks: number[] = [];
	let named = 0;

	for (const answer of answers) {
		const mention = answer.mentions.find((m) => names.includes(m.entity.toLowerCase()));
		if (!mention) continue;
		named += 1;
		ranks.push(mention.rank);
		const question = texts.get(answer.promptId) ?? "(deleted question)";
		const entry = questions.get(question) ?? { engines: new Set<string>(), brandNamed: false };
		entry.engines.add(answer.engine);
		entry.brandNamed ||= answer.brandRank !== null;
		questions.set(question, entry);

		const quote = quotes.length < MAX_QUOTES ? quoteOf(answer.text, names) : null;
		if (quote) quotes.push({ engine: answer.engine, question, text: quote });

		for (const citation of answer.citations) {
			if (own.some((site) => sameSite(citation.domain, site))) {
				const page = pages.get(citation.url) ?? { title: citation.title ?? null, citations: 0 };
				page.citations += 1;
				pages.set(citation.url, page);
			} else if (!known.some((site) => sameSite(citation.domain, site))) {
				const site = sites.get(citation.domain) ?? { citations: 0, namesBrand: false };
				site.citations += 1;
				site.namesBrand ||= answer.brandRank !== null;
				sites.set(citation.domain, site);
			}
		}
	}

	return {
		name: competitor.name,
		runId: run.id,
		answers: answers.length,
		named,
		averageRank: ranks.length ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length : null,
		questions: [...questions.entries()]
			.map(([question, entry]) => ({ question, engines: [...entry.engines].sort(), brandNamed: entry.brandNamed }))
			.sort((a, b) => Number(a.brandNamed) - Number(b.brandNamed) || a.question.localeCompare(b.question)),
		quotes,
		sites: [...sites.entries()]
			.map(([domain, entry]) => ({ domain, ...entry }))
			.sort((a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain))
			.slice(0, MAX_SITES),
		pages: [...pages.entries()]
			.map(([url, entry]) => ({ url, ...entry }))
			.sort((a, b) => b.citations - a.citations || a.url.localeCompare(b.url))
			.slice(0, MAX_PAGES),
	};
}
