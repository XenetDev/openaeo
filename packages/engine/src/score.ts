import type { MatchResult } from "./match";

export type Metrics = {
	answers: number;
	mentionRate: number;
	averageRank: number | null;
	shareOfVoice: number;
	citationRate: number;
};

export function metrics(results: MatchResult[]): Metrics {
	let mentioned = 0;
	let cited = 0;
	let rankTotal = 0;
	let brandCount = 0;
	let allCount = 0;
	for (const result of results) {
		if (result.brandCited) cited += 1;
		for (const mention of result.mentions) {
			allCount += mention.count;
			if (mention.rank === result.brandRank) brandCount += mention.count;
		}
		if (result.brandRank !== null) {
			mentioned += 1;
			rankTotal += result.brandRank;
		}
	}
	const answers = results.length;
	return {
		answers,
		mentionRate: answers ? mentioned / answers : 0,
		averageRank: mentioned ? rankTotal / mentioned : null,
		shareOfVoice: allCount ? brandCount / allCount : 0,
		citationRate: answers ? cited / answers : 0,
	};
}

const WEIGHTS = { mentions: 40, rank: 25, shareOfVoice: 20, citations: 15 };

const unit = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function visibility(m: Metrics): number {
	const mentionRate = unit(m.mentionRate);
	const rank = m.averageRank === null || !Number.isFinite(m.averageRank) ? null : Math.max(1, m.averageRank);
	const rankQuality = rank === null ? 0 : 2 / (rank + 1);
	const score =
		WEIGHTS.mentions * mentionRate +
		WEIGHTS.rank * rankQuality * mentionRate +
		WEIGHTS.shareOfVoice * unit(m.shareOfVoice) +
		WEIGHTS.citations * unit(m.citationRate);
	return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}
