import type { MatchResult } from "./match";

export type Metrics = {
	answers: number;
	mentionRate: number;
	averageRank: number | null;
	rankScore: number;
	shareOfVoice: number;
	citationRate: number;
};

export function metrics(results: MatchResult[]): Metrics {
	let mentioned = 0;
	let cited = 0;
	let rankTotal = 0;
	let rankCredit = 0;
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
			rankCredit += 2 / (Math.max(1, result.brandRank) + 1);
		}
	}
	const answers = results.length;
	return {
		answers,
		mentionRate: answers ? mentioned / answers : 0,
		averageRank: mentioned ? rankTotal / mentioned : null,
		rankScore: answers ? rankCredit / answers : 0,
		shareOfVoice: allCount ? brandCount / allCount : 0,
		citationRate: answers ? cited / answers : 0,
	};
}

const WEIGHTS = { mentions: 40, rank: 25, shareOfVoice: 20, citations: 15 };

const unit = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function visibility(m: Metrics): number {
	const score =
		WEIGHTS.mentions * unit(m.mentionRate) +
		WEIGHTS.rank * unit(m.rankScore) +
		WEIGHTS.shareOfVoice * unit(m.shareOfVoice) +
		WEIGHTS.citations * unit(m.citationRate);
	return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}
