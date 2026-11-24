import { expect, test } from "bun:test";
import type { MatchResult } from "../src/match";
import { metrics } from "../src/score";

function result(brand: { rank: number; count: number } | null, others: number[], cited = false): MatchResult {
	const mentions = others.map((count, i) => ({ entity: `Other${i}`, rank: 0, firstIndex: i, count }));
	if (brand) mentions.splice(brand.rank - 1, 0, { entity: "Brand", rank: 0, firstIndex: 0, count: brand.count });
	mentions.forEach((m, i) => {
		m.rank = i + 1;
	});
	return {
		mentions,
		brandMentioned: brand !== null,
		brandRank: brand?.rank ?? null,
		brandCited: cited,
		brandSourced: cited,
		citedDomains: [],
	};
}

test("metrics summarise a set of answers", () => {
	const m = metrics([
		result({ rank: 1, count: 2 }, [1, 1], true),
		result({ rank: 3, count: 1 }, [2, 2]),
		result(null, [2]),
		result(null, [1]),
	]);
	expect(m).toEqual({ answers: 4, mentionRate: 0.5, averageRank: 2, shareOfVoice: 0.25, citationRate: 0.25 });
});

test("metrics of no answers are zero with no rank", () => {
	expect(metrics([])).toEqual({ answers: 0, mentionRate: 0, averageRank: null, shareOfVoice: 0, citationRate: 0 });
});

test("answers that mention nobody do not divide by zero", () => {
	expect(metrics([result(null, []), result(null, [])])).toEqual({ answers: 2, mentionRate: 0, averageRank: null, shareOfVoice: 0, citationRate: 0 });
});

test("a brand that is the only one mentioned has full share of voice", () => {
	const m = metrics([result({ rank: 1, count: 3 }, [])]);
	expect(m.shareOfVoice).toBe(1);
	expect(m.averageRank).toBe(1);
	expect(m.mentionRate).toBe(1);
});
