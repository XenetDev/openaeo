import type { EngineInfo } from "@openaeo/ui";
import type { ReactNode } from "react";
import { css as pageCss } from "@/components/analytics";

export const percent = (value: number) => `${Math.round((Number.isFinite(value) ? value : 0) * 100)}%`;
export const engineLabel = (engines: EngineInfo[], id: string) => engines.find((e) => e.id === id)?.label ?? id;
export const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const byLine = (value: string) =>
	value
		.split("\n")
		.map((v) => v.trim())
		.filter(Boolean);

export function ordinal(n: number): string {
	const tens = n % 100;
	if (tens >= 11 && tens <= 13) return `${n}th`;
	return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export function Page({ brand, title, actions, children }: { brand: string; title: string; actions?: ReactNode; children: ReactNode }) {
	return (
		<div className="ui-as-rev">
			<style href="ui-screen-analytics" precedence="default">
				{pageCss}
			</style>
			<header className="ui-as-rev__head">
				<h1 className="ui-as-rev__path">
					<span>{brand}</span>
					<i>/</i>
					<b>{title}</b>
				</h1>
				{actions ? <div className="ui-as-rev__actions">{actions}</div> : null}
			</header>
			<div className="ui-as-rev__content">{children}</div>
		</div>
	);
}

export function ShareList({ items, empty }: { items: { label: string; value: string; share: number; badge?: ReactNode }[]; empty?: ReactNode }) {
	if (items.length === 0) return <>{empty}</>;
	return (
		<div className="ui-as-rev__products">
			{items.map((item) => (
				<div key={item.label} className="ui-as-rev__product">
					<span>
						<span className="ui-as-rev__product-name" title={item.label}>
							{item.label} {item.badge}
						</span>
						<b>{item.value}</b>
					</span>
					<i style={{ width: `${Math.min(100, Math.max(0, item.share))}%` }} />
				</div>
			))}
		</div>
	);
}
