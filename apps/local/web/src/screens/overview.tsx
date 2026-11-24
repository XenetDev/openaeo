import type { EngineInfo, PageId, ProjectView, ReportView } from "@openaeo/ui";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button-clean";
import { StatCard } from "@/components/ui/stat-card-clean";
import { TrendChart } from "@/components/ui/trend-chart-clean";
import { day, engineLabel, Head, Meter, percent, when } from "./shared";

type Props = {
	project: ProjectView;
	report: ReportView;
	engines: EngineInfo[];
	onRun: () => void;
	onCancel: () => void;
	onNavigate: (page: PageId) => void;
};

export function OverviewScreen({ project, report, engines, onRun, onCancel, onNavigate }: Props) {
	const { run, overall, trend } = report;
	const m = overall.metrics;
	const running = run?.status === "running";
	const usable = engines.filter((e) => e.available && e.enabled);
	const blocked = engines.filter((e) => !e.available && e.id !== "openai");
	const problems = report.problems ?? [];
	const hasData = m.answers > 0;
	const previous = trend.length > 1 ? trend[trend.length - 2] : undefined;
	const visibilityChange = previous ? overall.visibility - previous.visibility : undefined;
	const mentionChange = previous ? (m.mentionRate - previous.mentionRate) * 100 : undefined;
	const points = (n: number) => `${Math.abs(n).toFixed(1)} pts`;
	const spark = (values: number[], label: string) =>
		values.length > 1 ? <TrendChart variant="sparkline" label={label} labels={trend.map((t) => day(t.startedAt))} series={[{ label, values }]} /> : undefined;

	return (
		<div className="oa-view">
			<Head
				section="Overview"
				title={`How AI answers talk about ${project.name}`}
				sub={run && hasData ? `From the run on ${when(run.startedAt)}${run.status === "interrupted" ? ", which was interrupted" : ""}` : undefined}
				actions={
					running && run ? (
						<>
							<span className="oa-dim" role="status">
								Asking… {run.completed} of {run.total}
							</span>
							<Button variant="secondary" size="sm" onClick={onCancel}>
								Stop
							</Button>
						</>
					) : (
						<Button size="sm" onClick={onRun} disabled={usable.length === 0}>
							Run now
						</Button>
					)
				}
			/>

			{running && run ? (
				<div className="oa-progress" role="progressbar" aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={run.completed}>
					<i style={{ width: `${run.total ? (run.completed / run.total) * 100 : 0}%` }} />
				</div>
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

			{problems.length > 0 && !running ? (
				<div className="oa-alert" role={hasData ? undefined : "alert"}>
					<strong>{hasData ? "Some questions could not be answered in this run." : "The last run got no answers."}</strong>
					<ul>
						{problems.map((p) => (
							<li key={`${p.engine}:${p.message}`}>
								<strong>{engineLabel(engines, p.engine)}:</strong> {p.message}
							</li>
						))}
					</ul>
				</div>
			) : null}

			{!hasData ? (
				problems.length > 0 && !running ? null : (
					<EmptyState
						title="No runs yet"
						text="A run asks each AI engine every question on your Prompts page, then records who was mentioned and which sites were cited. It takes about half a minute per question."
						action={
							<Button variant="secondary" size="sm" onClick={() => onNavigate("prompts")}>
								Review your questions
							</Button>
						}
					/>
				)
			) : (
				<>
					<div className="oa-grid oa-grid-4">
						<StatCard
							label="Visibility score"
							value={overall.visibility}
							format={(n) => n.toFixed(1)}
							change={visibilityChange}
							changeFormat={points}
							changeLabel={previous ? "vs last run" : undefined}
							chart={spark(
								trend.map((t) => t.visibility),
								"Visibility",
							)}
						/>
						<StatCard
							label="Mentioned in"
							value={m.mentionRate * 100}
							format={(n) => `${Math.round(n)}%`}
							change={mentionChange}
							changeFormat={points}
							changeLabel={`of ${m.answers} answers`}
							chart={spark(
								trend.map((t) => t.mentionRate * 100),
								"Mention rate",
							)}
						/>
						<StatCard label="Your site cited in" value={m.citationRate * 100} format={(n) => `${Math.round(n)}%`} changeLabel="of answers" />
						<StatCard label="Average position" value={m.averageRank === null ? "–" : m.averageRank.toFixed(1)} changeLabel="among tracked brands" />
					</div>

					<div className="oa-grid oa-grid-2">
						<section className="oa-card">
							<h2 className="oa-cap">
								Visibility over time <span>{trend.length === 1 ? "1 run" : `${trend.length} runs`}</span>
							</h2>
							{trend.length > 1 ? (
								<TrendChart
									variant="area"
									label="Visibility score per run"
									labels={trend.map((t) => day(t.startedAt))}
									tooltipLabels={trend.map((t) => when(t.startedAt))}
									format={(n) => n.toFixed(1)}
									series={[{ label: "Visibility", values: trend.map((t) => t.visibility) }]}
								/>
							) : (
								<p className="oa-note">The trend appears after two runs. Each run adds a point.</p>
							)}
						</section>
						<section className="oa-card">
							<h2 className="oa-cap">
								By engine <span>visibility</span>
							</h2>
							<ul className="oa-rows">
								{report.engines.map((e) => (
									<li key={e.engine} className="oa-row" data-you="true">
										<span className="oa-row-name">
											{engineLabel(engines, e.engine)}
											{e.errors > 0 ? (
												<span className="oa-tag" data-tone="bad">
													{e.errors} failed
												</span>
											) : null}
										</span>
										<Meter value={e.visibility / 100} />
										<span className="oa-num">{e.visibility}</span>
									</li>
								))}
							</ul>
							<p className="oa-note" style={{ marginTop: 10 }}>
								Each engine is asked through its own tool with web search on. Results can differ from the consumer apps.
							</p>
						</section>
					</div>

					<div className="oa-grid oa-grid-half">
						<section className="oa-card">
							<h2 className="oa-cap">
								Who gets mentioned <span>share of answers</span>
							</h2>
							<ul className="oa-rows">
								{report.competitors.slice(0, 7).map((c) => (
									<li key={c.name} className="oa-row" data-you={c.isBrand}>
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
									</li>
								))}
							</ul>
						</section>
						<section className="oa-card">
							<h2 className="oa-cap">
								Most cited sites <span>citations</span>
							</h2>
							{report.topDomains.length === 0 ? (
								<p className="oa-note">No links were cited in this run.</p>
							) : (
								<ul className="oa-rows">
									{report.topDomains.slice(0, 7).map((d) => (
										<li key={d.domain} className="oa-row" data-you={d.isBrand}>
											<span className="oa-row-name">
												{d.domain}
												{d.isBrand ? (
													<span className="oa-tag" data-tone="you">
														Yours
													</span>
												) : null}
											</span>
											<Meter value={d.citations / Math.max(1, report.topDomains[0]?.citations ?? 1)} />
											<span className="oa-num">{d.citations}</span>
										</li>
									))}
								</ul>
							)}
						</section>
					</div>
				</>
			)}
		</div>
	);
}
