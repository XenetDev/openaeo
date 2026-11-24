import type { Source } from "./types";

const TRACKING = new Set(["fp_ref", "ref", "fr", "gclid", "fbclid"]);
const TRAILING = new Set([..."., ;:!?]}'\"*`>”“’‘…。，、）】」"]);
const URL_BODY = "[^\\s\"'<>\\[\\]\\\\”“’‘…。，、）】」]+";
const ENTITY_AT_END = /&(quot|amp|gt|lt|apos);?$/i;

export const URL_SOURCE = `https?:\\/\\/${URL_BODY}`;

function trim(raw: string): string {
	const value = raw.trim();
	let end = value.length;
	let open = 0;
	let close = 0;
	for (const char of value) {
		if (char === "(") open += 1;
		else if (char === ")") close += 1;
	}
	while (end > 0) {
		const entity = ENTITY_AT_END.exec(value.slice(Math.max(0, end - 6), end));
		if (entity) {
			end -= entity[0].length;
			continue;
		}
		const last = value[end - 1] as string;
		if (TRAILING.has(last)) {
			end -= 1;
			continue;
		}
		if (last === ")" && close > open) {
			end -= 1;
			close -= 1;
			continue;
		}
		break;
	}
	return value.slice(0, end);
}

export function normalizeUrl(raw: string): string | null {
	const value = trim(raw).replace(/&amp;/gi, "&");
	if (!/^https?:\/\//i.test(value)) return null;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return null;
	}
	if (url.hostname.endsWith(".")) url.hostname = url.hostname.slice(0, -1);
	if (!url.hostname.includes(".")) return null;
	for (const key of [...url.searchParams.keys()]) {
		const lower = key.toLowerCase();
		if (TRACKING.has(lower) || lower.startsWith("utm_")) url.searchParams.delete(key);
	}
	url.hash = "";
	return url.toString();
}

export function toDomain(url: string): string | null {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
		return parsed.hostname
			.toLowerCase()
			.replace(/\.$/, "")
			.replace(/^www\./, "");
	} catch {
		return null;
	}
}

export function extractUrls(text: string): string[] {
	const found = text.match(new RegExp(URL_SOURCE, "gi")) ?? [];
	const seen = new Set<string>();
	for (const candidate of found) {
		const url = normalizeUrl(candidate);
		if (url) seen.add(url);
	}
	return [...seen];
}

export function toSource(url: string, title?: string): Source | null {
	const normalized = normalizeUrl(url);
	if (!normalized) return null;
	const domain = toDomain(normalized);
	if (!domain) return null;
	return title ? { url: normalized, domain, title } : { url: normalized, domain };
}

export function sameSite(domain: string, site: string): boolean {
	const a = domain.toLowerCase().replace(/^www\./, "");
	const b = site.toLowerCase().replace(/^www\./, "");
	return a === b || a.endsWith(`.${b}`);
}
