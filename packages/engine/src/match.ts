import type { Answer } from "./types";
import { sameSite, toDomain, URL_SOURCE } from "./url";

export type Entity = { name: string; aliases?: string[]; domains?: string[] };

export type Mention = { entity: string; rank: number; firstIndex: number; count: number };

export type MatchResult = {
	mentions: Mention[];
	brandMentioned: boolean;
	brandRank: number | null;
	brandCited: boolean;
	brandSourced: boolean;
	citedDomains: string[];
};

const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
const ORDINARY_WORD = /^\p{Lu}\p{Ll}*$/u;

type Term = { entity: number; firstChar: string | null };

const keyOf = (text: string) => text.toLowerCase().replace(/\s+/g, " ");
const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");

function buildPattern(terms: string[]): RegExp | null {
	const longestFirst = [...terms].sort((a, b) => b.length - a.length);
	const spaced = longestFirst.filter((t) => !UNSPACED_SCRIPT.test(t)).map(escape);
	const unspaced = longestFirst.filter((t) => UNSPACED_SCRIPT.test(t)).map(escape);
	const parts: string[] = [];
	if (spaced.length) parts.push(`(?<![\\p{L}\\p{N}])(?:${spaced.join("|")})(?![\\p{L}\\p{N}])`);
	if (unspaced.length) parts.push(`(?:${unspaced.join("|")})`);
	return parts.length ? new RegExp(parts.join("|"), "giu") : null;
}

function siteOf(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	return toDomain(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
}

export function match(
	answer: Pick<Answer, "text" | "citations" | "sources">,
	brand: Entity,
	competitors: Entity[],
): MatchResult {
	const entities: { name: string; terms: string[] }[] = [];
	const seen = new Set<string>();
	for (const entity of [brand, ...competitors]) {
		const name = entity.name.trim();
		const key = name.toLowerCase();
		if (!name || seen.has(key)) continue;
		seen.add(key);
		const terms = [name, ...(entity.aliases ?? []).map((a) => a.trim()).filter(Boolean)];
		entities.push({ name, terms });
	}

	const lookup = new Map<string, Term>();
	const terms: string[] = [];
	entities.forEach((entity, index) => {
		for (const term of entity.terms) {
			const key = keyOf(term);
			if (lookup.has(key)) continue;
			lookup.set(key, { entity: index, firstChar: ORDINARY_WORD.test(term) ? (term[0] ?? null) : null });
			terms.push(term);
		}
	});

	const found = new Map<number, { firstIndex: number; count: number }>();
	const pattern = buildPattern(terms);
	if (pattern) {
		const text = answer.text.replace(new RegExp(URL_SOURCE, "gi"), (url) => " ".repeat(url.length));
		for (const hit of text.matchAll(pattern)) {
			const term = lookup.get(keyOf(hit[0]));
			if (!term) continue;
			if (term.firstChar !== null && hit[0][0] !== term.firstChar) continue;
			const entry = found.get(term.entity);
			if (entry) entry.count += 1;
			else found.set(term.entity, { firstIndex: hit.index, count: 1 });
		}
	}

	const mentions = [...found.entries()]
		.sort((a, b) => a[1].firstIndex - b[1].firstIndex)
		.map(([index, entry], position) => ({
			entity: entities[index]?.name ?? "",
			rank: position + 1,
			firstIndex: entry.firstIndex,
			count: entry.count,
		}));

	const brandName = brand.name.trim();
	const brandMention = brandName ? mentions.find((m) => m.entity === brandName) : undefined;
	const sites = (brand.domains ?? []).map(siteOf).filter((site): site is string => site !== null);
	const onBrandSite = (domain: string) => sites.some((site) => sameSite(domain, site));
	const brandCited = answer.citations.some((c) => onBrandSite(c.domain));

	return {
		mentions,
		brandMentioned: brandMention !== undefined,
		brandRank: brandMention?.rank ?? null,
		brandCited,
		brandSourced: brandCited || answer.sources.some((s) => onBrandSite(s.domain)),
		citedDomains: [...new Set(answer.citations.map((c) => c.domain))],
	};
}
