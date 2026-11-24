import type { EngineView } from "@api";
import type { ReactNode } from "react";
import { css as pageCss } from "@/components/analytics";
import { GeminiLogo, GrokLogo, PerplexityLogo } from "@/components/engine-logos";
import { Avatar } from "@/components/ui/avatar-clean";
import { ChatGPTLogo, ClaudeLogo } from "@/components/ui/chat-composer-clean";
import { Select } from "@/components/ui/select-clean";

export const percent = (value: number) => `${Math.round((Number.isFinite(value) ? value : 0) * 100)}%`;
export const engineLabel = (engines: EngineView[], id: string) => engines.find((e) => e.id === id)?.label ?? id;
export const when = (ms: number) =>
	new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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

export function Page({
	brand,
	title,
	actions,
	children,
}: {
	brand: string;
	title: string;
	actions?: ReactNode;
	children: ReactNode;
}) {
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

export function ShareList({
	items,
	empty,
}: {
	items: { label: string; value: string; share: number; badge?: ReactNode }[];
	empty?: ReactNode;
}) {
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

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
	return (
		<dl className="oa-facts">
			{rows.map(([term, value]) => (
				<div key={term}>
					<dt>{term}</dt>
					<dd>{value}</dd>
				</div>
			))}
		</dl>
	);
}

export function span(ms: number): string {
	const s = Math.max(0, Math.round(ms / 1000));
	return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

const ENGINE_LOGOS: Record<string, ReactNode> = {
	"claude-cli": <ClaudeLogo />,
	anthropic: <ClaudeLogo />,
	"codex-cli": <ChatGPTLogo />,
	openai: <ChatGPTLogo />,
	xai: <GrokLogo />,
	gemini: <GeminiLogo />,
	perplexity: <PerplexityLogo />,
};

export function EngineLogo({ engine, label, size = 16 }: { engine: string; label: string; size?: number }) {
	const logo = ENGINE_LOGOS[engine];
	if (logo) {
		return (
			<span className="oa-engine-logo" style={{ width: size, height: size }}>
				{logo}
			</span>
		);
	}
	return <Avatar kind="agent" name={label} seed={engine} size={20} />;
}

export function TagFilter({ tags, tag, onTag }: { tags: string[]; tag: string; onTag: (tag: string) => void }) {
	if (tags.length === 0) return null;
	return (
		<Select
			size="sm"
			aria-label="Filter by tag"
			value={tag}
			onChange={onTag}
			options={[{ value: "", label: "All tags" }, ...tags.map((value) => ({ value, label: value }))]}
		/>
	);
}
