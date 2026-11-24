import type { Source } from "./types";

const TRACKING = new Set(["fp_ref", "ref", "fr", "gclid", "fbclid"]);
const TRAILING = new Set([".", ",", ";", ":", "!", "?", "]", "}", "'", '"', "*", "`", ">"]);

function trim(raw: string): string {
	let value = raw.trim();
	for (;;) {
		const before = value;
		value = value.replace(/&(quot|amp|gt|lt|apos);?$/i, "");
		const last = value.at(-1);
		if (last !== undefined && TRAILING.has(last)) value = value.slice(0, -1);
		if (value.endsWith(")") && !value.includes("(")) value = value.slice(0, -1);
		if (value === before) return value;
	}
}

export function normalizeUrl(raw: string): string | null {
	const value = trim(raw);
	if (!/^https?:\/\//i.test(value)) return null;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return null;
	}
	if (!url.hostname.includes(".")) return null;
	for (const key of [...url.searchParams.keys()]) {
		if (TRACKING.has(key) || key.startsWith("utm_")) url.searchParams.delete(key);
	}
	url.hash = "";
	return url.toString();
}

export function toDomain(url: string): string | null {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
		return parsed.hostname.toLowerCase().replace(/^www\./, "");
	} catch {
		return null;
	}
}

export function extractUrls(text: string): string[] {
	const found = text.match(/https?:\/\/[^\s"'<>\]\\]+/gi) ?? [];
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
