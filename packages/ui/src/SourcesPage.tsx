import type { ReportView } from "./types";

export function SourcesPage({ report }: { report: ReportView }) {
	const max = Math.max(1, ...report.topDomains.map((d) => d.citations));
	return (
		<div className="oa-page">
			<header className="oa-head">
				<div>
					<p className="oa-eyebrow">Sources</p>
					<h1 className="oa-title">The sites AI answers cite</h1>
				</div>
			</header>
			{report.topDomains.length === 0 ? (
				<section className="oa-empty">
					<h2>No sources yet</h2>
					<p>After a run, this lists the sites the engines linked to. These are the places worth being mentioned on.</p>
				</section>
			) : (
				<div className="oa-rows">
					{report.topDomains.map((d) => (
						<div key={d.domain} className="oa-row" data-brand={d.isBrand}>
							<span className="oa-row-name">
								{d.domain} {d.isBrand ? <span className="oa-tag oa-tag-you">Yours</span> : null}
							</span>
							<span className="oa-meter" aria-hidden="true">
								<span style={{ width: `${(d.citations / max) * 100}%` }} />
							</span>
							<span className="oa-row-value">{d.citations}</span>
							<span className="oa-row-note">{d.citations === 1 ? "citation" : "citations"}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
