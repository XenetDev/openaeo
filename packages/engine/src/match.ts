import type { Answer } from "./types";
import { sameSite, toDomain } from "./url";

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

const URL_PATTERN = /https?:\/\/[^\s)\]>"']+/gi;
const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

function pattern(term: string): RegExp {
	const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
	if (UNSPACED_SCRIPT.test(term)) return new RegExp(escaped, "giu");
	return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
}

function siteOf(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	return toDomain(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
}

export function match(answer: Pick<Answer, "text" | "citations" | "sources">, brand: Entity, competitors: Entity[]): MatchResult {
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

	const terms = entities
		.flatMap((entity, index) => entity.terms.map((term) => ({ term, index })))
		.sort((a, b) => b.term.length - a.term.length);

	let text = answer.text.replace(URL_PATTERN, (url) => " ".repeat(url.length));
	const found = new Map<number, { firstIndex: number; count: number }>();
	for (const { term, index } of terms) {
		text = text.replace(pattern(term), (hit: string, offset: number) => {
			const entry = found.get(index);
			if (entry) {
				entry.count += 1;
				entry.firstIndex = Math.min(entry.firstIndex, offset);
			} else {
				found.set(index, { firstIndex: offset, count: 1 });
			}
			return " ".repeat(hit.length);
		});
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
