"use client";
import { useState } from "react";
import { byLine, percent, position } from "./format";
import type { EntityView, ReportView } from "./types";

export type CompetitorsPageProps = { report: ReportView; competitors: EntityView[]; onSave: (competitors: EntityView[]) => void };

export function CompetitorsPage({ report, competitors, onSave }: CompetitorsPageProps) {
	const [draft, setDraft] = useState(competitors.map((c) => c.name).join("\n"));
	return (
		<div className="oa-page">
			<header className="oa-head">
				<div>
					<p className="oa-eyebrow">Competitors</p>
					<h1 className="oa-title">Who gets mentioned instead of you</h1>
				</div>
			</header>
			<div className="oa-rows">
				{report.competitors.map((c) => (
					<div key={c.name} className="oa-row" data-brand={c.isBrand}>
						<span className="oa-row-name">
							{c.name} {c.isBrand ? <span className="oa-tag oa-tag-you">You</span> : null}
						</span>
						<span className="oa-meter" aria-hidden="true">
							<span style={{ width: `${Math.min(100, c.mentionRate * 100)}%` }} />
						</span>
						<span className="oa-row-value">{percent(c.mentionRate)}</span>
						<span className="oa-row-note">{c.averageRank === null ? "Not mentioned" : `average position ${position(c.averageRank)}`}</span>
					</div>
				))}
			</div>
			<form
				className="oa-form"
				onSubmit={(e) => {
					e.preventDefault();
					const known = new Map(competitors.map((c) => [c.name.toLowerCase(), c]));
					onSave(byLine(draft).map((name) => known.get(name.toLowerCase()) ?? { name, aliases: [], domains: [] }));
				}}
			>
				<label className="oa-label" htmlFor="oa-competitors">
					Tracked competitors, one per line
				</label>
				<textarea id="oa-competitors" className="oa-input" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} />
				<div className="oa-actions">
					<button type="submit" className="oa-button">
						Save competitors
					</button>
					<span className="oa-muted">Changes apply from the next run.</span>
				</div>
			</form>
		</div>
	);
}
