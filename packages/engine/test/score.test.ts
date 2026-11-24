import { expect, test } from "bun:test";
import type { MatchResult } from "../src/match";
import { metrics, visibility } from "../src/score";

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

const base = { answers: 10, mentionRate: 0.5, averageRank: 2, shareOfVoice: 0.25, citationRate: 0.2 };

test("visibility is 0 when the brand never appears", () => {
	expect(visibility({ answers: 10, mentionRate: 0, averageRank: null, shareOfVoice: 0, citationRate: 0 })).toBe(0);
	expect(visibility({ answers: 0, mentionRate: 0, averageRank: null, shareOfVoice: 0, citationRate: 0 })).toBe(0);
});

test("visibility is 100 for a brand that is always first, alone and cited", () => {
	expect(visibility({ answers: 10, mentionRate: 1, averageRank: 1, shareOfVoice: 1, citationRate: 1 })).toBe(100);
});

test("visibility stays within 0..100 and is finite", () => {
	for (const mentionRate of [0, 0.1, 0.5, 1]) {
		for (const averageRank of [null, 1, 2.5, 10, 50]) {
			for (const shareOfVoice of [0, 0.3, 1]) {
				for (const citationRate of [0, 0.4, 1]) {
					const score = visibility({ answers: 10, mentionRate, averageRank, shareOfVoice, citationRate });
					expect(Number.isFinite(score)).toBe(true);
					expect(score).toBeGreaterThanOrEqual(0);
					expect(score).toBeLessThanOrEqual(100);
				}
			}
		}
	}
});

test("more mentions never lower visibility", () => {
	expect(visibility({ ...base, mentionRate: 0.8 })).toBeGreaterThanOrEqual(visibility(base));
});

test("a worse average rank never raises visibility", () => {
	expect(visibility({ ...base, averageRank: 5 })).toBeLessThanOrEqual(visibility(base));
});

test("more citations and more share of voice never lower visibility", () => {
	expect(visibility({ ...base, citationRate: 0.6 })).toBeGreaterThanOrEqual(visibility(base));
	expect(visibility({ ...base, shareOfVoice: 0.6 })).toBeGreaterThanOrEqual(visibility(base));
});

test("visibility weighs mentions most and rewards position only when mentioned", () => {
	expect(visibility({ answers: 10, mentionRate: 1, averageRank: null, shareOfVoice: 0, citationRate: 0 })).toBe(40);
	expect(visibility({ answers: 10, mentionRate: 1, averageRank: 1, shareOfVoice: 0, citationRate: 0 })).toBe(65);
	expect(visibility({ answers: 10, mentionRate: 1, averageRank: 3, shareOfVoice: 0, citationRate: 0 })).toBe(52.5);
	expect(visibility({ answers: 10, mentionRate: 0.5, averageRank: 1, shareOfVoice: 0, citationRate: 0 })).toBe(32.5);
	expect(visibility({ answers: 10, mentionRate: 0, averageRank: null, shareOfVoice: 0, citationRate: 1 })).toBe(15);
});

test("visibility tolerates out-of-range and non-finite inputs", () => {
	expect(visibility({ answers: 1, mentionRate: 2, averageRank: 0, shareOfVoice: 5, citationRate: 9 })).toBe(100);
	expect(visibility({ answers: 1, mentionRate: Number.NaN, averageRank: Number.NaN, shareOfVoice: -1, citationRate: Number.NaN })).toBe(0);
});
