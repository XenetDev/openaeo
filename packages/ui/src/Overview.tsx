import { engineLabel, percent, position, when } from "./format";
import { TrendChart } from "./TrendChart";
import type { EngineInfo, PageId, ProjectView, ReportView } from "./types";

export type OverviewProps = {
	project: ProjectView;
	report: ReportView;
	engines: EngineInfo[];
	onRun: () => void;
	onCancel: () => void;
	onNavigate: (page: PageId) => void;
	error?: string | null;
};

export function Overview({ project, report, engines, onRun, onCancel, onNavigate, error }: OverviewProps) {
	const { run, overall } = report;
	const running = run?.status === "running";
	const usable = engines.filter((e) => e.available && e.enabled);
	const blocked = engines.filter((e) => !e.available && e.id !== "openai");
	const hasData = overall.metrics.answers > 0;
	const m = overall.metrics;

	return (
		<div className="oa-page">
			<header className="oa-head">
				<div>
					<p className="oa-eyebrow">Overview</p>
					<h1 className="oa-title">How AI answers talk about {project.name}</h1>
				</div>
				<div className="oa-actions">
					{running && run ? (
						<>
							<span className="oa-progress" role="status">
								Asking… {run.completed} of {run.total}
							</span>
							<button type="button" className="oa-button oa-button-quiet" onClick={onCancel}>
								Stop
							</button>
						</>
					) : (
						<button type="button" className="oa-button" onClick={onRun} disabled={usable.length === 0}>
							Run now
						</button>
					)}
				</div>
			</header>

			{error ? (
				<p className="oa-alert" role="alert">
					{error}
				</p>
			) : null}

			{usable.length === 0 ? (
				<div className="oa-alert" role="alert">
					<strong>No AI engine can run yet.</strong>
					<ul>
						{blocked.map((e) => (
							<li key={e.id}>{e.reason}</li>
						))}
					</ul>
				</div>
			) : null}

			{running && run ? <progress className="oa-bar-progress" max={run.total} value={run.completed} /> : null}

			{!hasData ? (
				<section className="oa-empty">
					<h2>No runs yet</h2>
					<p>
						A run asks each AI engine every question on your <button type="button" className="oa-link" onClick={() => onNavigate("prompts")}>Prompts</button> page,
						then records who was mentioned and which sites were cited. Press <em>Run now</em> to start; it takes about half a minute per question.
					</p>
				</section>
			) : (
				<>
					<section className="oa-hero">
						<div className="oa-score">
							<p className="oa-eyebrow">Visibility score</p>
							<p className="oa-score-value">
								{overall.visibility}
								<span>/100</span>
							</p>
							<p className="oa-muted">
								{run ? `From the run on ${when(run.startedAt)}` : ""}
								{run?.status === "interrupted" ? " · interrupted before it finished" : ""}
							</p>
						</div>
						<dl className="oa-tiles">
							<div className="oa-tile">
								<dt>Mentioned in</dt>
								<dd>{percent(m.mentionRate)}</dd>
								<p>of {m.answers} answers</p>
							</div>
							<div className="oa-tile">
								<dt>Your site cited in</dt>
								<dd>{percent(m.citationRate)}</dd>
								<p>of answers</p>
							</div>
							<div className="oa-tile">
								<dt>Average position</dt>
								<dd>{m.averageRank === null ? "–" : position(m.averageRank)}</dd>
								<p>among tracked brands</p>
							</div>
							<div className="oa-tile">
								<dt>Share of voice</dt>
								<dd>{percent(m.shareOfVoice)}</dd>
								<p>of all brand mentions</p>
							</div>
						</dl>
					</section>

					<section className="oa-section">
						<h2 className="oa-h2">By engine</h2>
						<p className="oa-muted">Each engine is asked through its own tool with web search on. Results can differ from the consumer apps.</p>
						<div className="oa-rows">
							{report.engines.map((e) => (
								<div key={e.engine} className="oa-row">
									<span className="oa-row-name">{engineLabel(engines, e.engine)}</span>
									<span className="oa-meter" aria-hidden="true">
										<span style={{ width: `${Math.min(100, Math.max(0, e.visibility))}%` }} />
									</span>
									<span className="oa-row-value">{e.visibility}</span>
									<span className="oa-row-note">
										mentioned {percent(e.metrics.mentionRate)} · cited {percent(e.metrics.citationRate)}
										{e.errors > 0 ? ` · ${e.errors} failed` : ""}
									</span>
								</div>
							))}
						</div>
					</section>

					<section className="oa-section">
						<h2 className="oa-h2">Visibility over time</h2>
						<TrendChart trend={report.trend} />
					</section>
				</>
			)}
		</div>
	);
}
