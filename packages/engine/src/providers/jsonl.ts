import type { Source } from "../types";
import { extractUrls, toSource } from "../url";

export function parseJsonLines(stdout: string): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	for (const line of stdout.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("{")) continue;
		try {
			const value: unknown = JSON.parse(trimmed);
			if (value && typeof value === "object" && !Array.isArray(value)) events.push(value as Record<string, unknown>);
		} catch {}
	}
	return events;
}

export function collectSources(found: { url: string; title?: string }[]): Source[] {
	const byUrl = new Map<string, Source>();
	for (const item of found) {
		const source = toSource(item.url, item.title);
		if (source && !byUrl.has(source.url)) byUrl.set(source.url, source);
	}
	return [...byUrl.values()];
}

export function citationsFrom(text: string, sources: Source[]): Source[] {
	const titles = new Map(sources.map((s) => [s.url, s.title]));
	const citations: Source[] = [];
	for (const url of extractUrls(text)) {
		const source = toSource(url, titles.get(url));
		if (source) citations.push(source);
	}
	return citations;
}
