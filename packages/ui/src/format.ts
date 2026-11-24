import type { EngineInfo } from "./types";

export const percent = (value: number) => `${Math.round((Number.isFinite(value) ? value : 0) * 100)}%`;

export const position = (rank: number | null) => (rank === null ? "Not mentioned" : rank.toFixed(1));

export function ordinal(n: number): string {
	const tens = n % 100;
	if (tens >= 11 && tens <= 13) return `${n}th`;
	return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export const engineLabel = (engines: EngineInfo[], id: string) => engines.find((e) => e.id === id)?.label ?? id;

export const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const lines = (value: string) =>
	value
		.split(/[\n,]/)
		.map((v) => v.trim())
		.filter(Boolean);

export const isHttp = (url: string) => /^https?:\/\//i.test(url);
