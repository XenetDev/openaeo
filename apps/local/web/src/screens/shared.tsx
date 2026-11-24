import type { EngineInfo } from "@openaeo/ui";
import type { ReactNode } from "react";

export const percent = (value: number) => `${Math.round((Number.isFinite(value) ? value : 0) * 100)}%`;
export const engineLabel = (engines: EngineInfo[], id: string) => engines.find((e) => e.id === id)?.label ?? id;
export const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function ordinal(n: number): string {
	const tens = n % 100;
	if (tens >= 11 && tens <= 13) return `${n}th`;
	return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export function Head({ section, title, sub, actions }: { section: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
	return (
		<header className="oa-head">
			<div>
				<p className="oa-path">
					OpenAEO / <b>{section}</b>
				</p>
				<h1 className="oa-title">{title}</h1>
				{sub ? <p className="oa-sub">{sub}</p> : null}
			</div>
			{actions ? <div className="oa-actions">{actions}</div> : null}
		</header>
	);
}

export function Meter({ value }: { value: number }) {
	return (
		<span className="oa-meter" aria-hidden="true">
			<i style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
		</span>
	);
}
