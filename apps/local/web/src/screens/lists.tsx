import type { EntityView, ReportView } from "@openaeo/ui";
import { useState } from "react";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button-clean";
import { Head, Meter, percent } from "./shared";

export function SourcesScreen({ report }: { report: ReportView }) {
	const max = Math.max(1, ...report.topDomains.map((d) => d.citations));
	return (
		<div className="oa-view">
			<Head section="Sources" title="The sites AI answers cite" sub="These are the places worth being mentioned on." />
			{report.topDomains.length === 0 ? (
				<EmptyState title="No sources yet" text="After a run, this lists the sites the engines linked to in their answers." />
			) : (
				<section className="oa-card">
					<ul className="oa-rows">
						{report.topDomains.map((d) => (
							<li key={d.domain} className="oa-row oa-row-wide" data-you={d.isBrand}>
								<span className="oa-row-name">
									{d.domain}
									{d.isBrand ? (
										<span className="oa-tag" data-tone="you">
											Yours
										</span>
									) : null}
								</span>
								<Meter value={d.citations / max} />
								<span className="oa-num">{d.citations}</span>
								<span className="oa-dim">{d.citations === 1 ? "citation" : "citations"} in the latest run</span>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}

const byLine = (value: string) =>
	value
		.split("\n")
		.map((v) => v.trim())
		.filter(Boolean);

export function CompetitorsScreen({ report, competitors, onSave }: { report: ReportView; competitors: EntityView[]; onSave: (next: EntityView[]) => void }) {
	const [draft, setDraft] = useState(competitors.map((c) => c.name).join("\n"));
	return (
		<div className="oa-view">
			<Head section="Competitors" title="Who gets mentioned instead of you" />
			<section className="oa-card">
				<ul className="oa-rows">
					{report.competitors.map((c) => (
						<li key={c.name} className="oa-row oa-row-wide" data-you={c.isBrand}>
							<span className="oa-row-name">
								{c.name}
								{c.isBrand ? (
									<span className="oa-tag" data-tone="you">
										You
									</span>
								) : null}
							</span>
							<Meter value={c.mentionRate} />
							<span className="oa-num">{percent(c.mentionRate)}</span>
							<span className="oa-dim">{c.averageRank === null ? "Not mentioned" : `average position ${c.averageRank.toFixed(1)}`}</span>
						</li>
					))}
				</ul>
			</section>
			<section className="oa-card">
				<form
					className="oa-form"
					onSubmit={(e) => {
						e.preventDefault();
						const known = new Map(competitors.map((c) => [c.name.toLowerCase(), c]));
						onSave(byLine(draft).map((name) => known.get(name.toLowerCase()) ?? { name, aliases: [], domains: [] }));
					}}
				>
					<div>
						<label className="oa-label" htmlFor="oa-competitors">
							Tracked competitors, one per line
						</label>
						<textarea id="oa-competitors" className="oa-textarea" rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
					</div>
					<div className="oa-actions">
						<Button type="submit" size="sm">
							Save competitors
						</Button>
						<span className="oa-dim">Changes apply from the next run.</span>
					</div>
				</form>
			</section>
		</div>
	);
}
