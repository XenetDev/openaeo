import type { EngineInfo, PageId, ProjectView, ReportView } from "@openaeo/ui";
import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { EmptyState } from "@/components/app-shell";
import { ChartCard } from "@/components/analytics";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { ChangeSummary, type MetricChange } from "@/components/ui/change-summary-clean";
import { StatCard } from "@/components/ui/stat-card-clean";
import { TrendChart } from "@/components/ui/trend-chart-clean";
import { day, engineLabel, Page, percent, ShareList, when } from "./shared";

type Props = {
	project: ProjectView;
	report: ReportView;
	engines: EngineInfo[];
	loading: boolean;
	onRun: () => void;
	onCancel: () => void;
	onNavigate: (page: PageId) => void;
};

const moved = (label: string, now: number, before: number, format: (n: number) => string, lowerIsBetter = false): MetricChange => {
	if (Math.abs(now - before) < 0.05) return { label, change: `Unchanged at ${format(now)}`, tone: "neutral" };
	const up = now > before;
	return { label, change: `${up ? "Up" : "Down"} to ${format(now)} from ${format(before)}`, tone: up !== lowerIsBetter ? "good" : "bad", direction: up ? "up" : "down" };
};

export function OverviewScreen({ project, report, engines, loading, onRun, onCancel, onNavigate }: Props) {
	const { run, overall, trend } = report;
	const m = overall.metrics;
	const running = run?.status === "running";
	const usable = engines.filter((e) => e.available && e.enabled);
	const blocked = engines.filter((e) => !e.available && e.id !== "openai");
	const problems = report.problems ?? [];
	const hasData = m.answers > 0;
	const previous = trend.length > 1 ? trend[trend.length - 2] : undefined;
	const labels = trend.map((t) => day(t.startedAt));
	const bars = (values: number[], label: string) =>
		values.length < 2 ? (
			<span />
		) : (
		<TrendChart variant="bar" axis={false} tooltip={false} height={22} label={`${label} by run`} labels={labels} series={[{ label, values, color: "var(--faint)" }]} />
		);

	const actions =
		running && run ? (
			<>
				<Badge tone="info" live>
					Asking {run.completed} of {run.total}
				</Badge>
				<Button variant="secondary" size="sm" onClick={onCancel}>
					Stop
				</Button>
			</>
		) : (
			<Button size="sm" onClick={onRun} disabled={usable.length === 0}>
				Run now
			</Button>
		);

	if (loading) {
		return (
			<Page brand={project.name} title="Overview" actions={actions}>
				<div className="ui-as-rev__stats">
					{["Visibility score", "Mentioned in", "Your site cited in", "Average position"].map((label) => (
						<StatCard key={label} className="ui-as-rev__stat" layout="inline" label={label} value="" change={0} loading chart={<span />} />
					))}
				</div>
				<div className="ui-as-rev__row ui-as-rev__row--main">
					<ChartCard tall loading title="Visibility over time" />
					<ChartCard loading title="By engine" />
				</div>
			</Page>
		);
	}

	const notices = (
		<>
			{usable.length === 0 ? (
				<Card>
					<CardHeader title="No AI engine can run yet" description="OpenAEO uses the AI tools signed in on this computer." action={<Badge tone="danger">Needs you</Badge>} />
					<CardContent>
						{blocked.map((e) => (
							<p key={e.id} className="oa-quiet">
								{e.reason}
							</p>
						))}
					</CardContent>
				</Card>
			) : null}
			{problems.length > 0 && !running ? (
				<Card>
					<CardHeader
						title={hasData ? "Some questions could not be answered in this run" : "The last run got no answers"}
						description={hasData ? undefined : "Fix the problem below, then press Run now."}
						action={<Badge tone={hasData ? "warning" : "danger"}>{problems.reduce((n, p) => n + p.count, 0)} failed</Badge>}
					/>
					<CardContent>
						{problems.map((p) => (
							<p key={`${p.engine}:${p.message}`} className="oa-quiet">
								{engineLabel(engines, p.engine)}: {p.message}
							</p>
						))}
					</CardContent>
				</Card>
			) : null}
		</>
	);

	if (!hasData) {
		return (
			<Page brand={project.name} title="Overview" actions={actions}>
				{notices}
				{problems.length > 0 && !running ? null : (
					<EmptyState
						icon={Analytics01Icon}
						title={running ? "Collecting the first answers" : "No runs yet"}
						text="A run asks each AI engine every question on your Prompts page, then records who was mentioned and which sites were cited. It takes about half a minute per question."
						action={
							running ? undefined : (
								<Button variant="secondary" size="sm" onClick={() => onNavigate("prompts")}>
									Review your questions
								</Button>
							)
						}
					/>
				)}
			</Page>
		);
	}

	const changes: MetricChange[] = previous
		? [
				moved("Visibility score", overall.visibility, previous.visibility, (n) => n.toFixed(1)),
				moved("Mentioned in", m.mentionRate * 100, previous.mentionRate * 100, (n) => `${Math.round(n)}%`),
			]
		: [];

	return (
		<Page brand={project.name} title="Overview" actions={actions}>
			{notices}
			<div className="ui-as-rev__stats">
				<StatCard
					className="ui-as-rev__stat"
					layout="inline"
					label="Visibility score"
					value={overall.visibility}
					format={(n) => n.toFixed(1)}
					change={previous ? overall.visibility - previous.visibility : undefined}
					changeFormat={(n) => n.toFixed(1)}
					chart={bars(
						trend.map((t) => t.visibility),
						"Visibility",
					)}
				/>
				<StatCard
					className="ui-as-rev__stat"
					layout="inline"
					label="Mentioned in"
					value={m.mentionRate * 100}
					format={(n) => `${Math.round(n)}%`}
					change={previous ? (m.mentionRate - previous.mentionRate) * 100 : undefined}
					changeFormat={(n) => `${Math.round(n)} pts`}
					chart={bars(
						trend.map((t) => t.mentionRate * 100),
						"Mention rate",
					)}
				/>
				<StatCard className="ui-as-rev__stat" layout="inline" label="Your site cited in" value={m.citationRate * 100} format={(n) => `${Math.round(n)}%`} chart={<span />} />
				<StatCard className="ui-as-rev__stat" layout="inline" label="Average position" value={m.averageRank === null ? "–" : m.averageRank.toFixed(1)} chart={<span />} />
			</div>

			<div className="ui-as-rev__row ui-as-rev__row--main">
				<ChartCard
					tall
					title="Visibility over time"
					value={overall.visibility}
					delta={previous ? overall.visibility - previous.visibility : undefined}
					format={(n) => n.toFixed(1)}
					labels={labels}
					tooltipLabels={trend.map((t) => when(t.startedAt))}
					series={[{ label: "Visibility", values: trend.map((t) => t.visibility) }]}
					footer={trend.length === 1 ? "One run so far. Each run adds a point." : `${trend.length} runs · latest ${run ? when(run.startedAt) : ""}`}
				/>
				<Card>
					<CardHeader title="By engine" description="Visibility score from each engine's answers" />
					<CardContent>
						<ShareList
							items={report.engines.map((e) => ({
								label: engineLabel(engines, e.engine),
								value: `${e.visibility}`,
								share: e.visibility,
								badge: e.errors > 0 ? <Badge tone="danger">{e.errors} failed</Badge> : undefined,
							}))}
						/>
						<p className="oa-quiet" style={{ marginTop: 12 }}>
							Each engine is asked through its own tool with web search on. Results can differ from the consumer apps.
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="ui-as-rev__row ui-as-rev__row--3">
				<Card>
					<CardHeader title="Who gets mentioned" description="Share of answers naming each brand" />
					<CardContent>
						<ShareList
							items={report.competitors.slice(0, 6).map((c) => ({
								label: c.name,
								value: percent(c.mentionRate),
								share: c.mentionRate * 100,
								badge: c.isBrand ? <Badge>You</Badge> : undefined,
							}))}
						/>
					</CardContent>
				</Card>
				<Card>
					<CardHeader title="Most cited sites" description="Links in the latest answers" />
					<CardContent>
						<ShareList
							items={report.topDomains.slice(0, 6).map((d) => ({
								label: d.domain,
								value: `${d.citations}`,
								share: (d.citations / Math.max(1, report.topDomains[0]?.citations ?? 1)) * 100,
								badge: d.isBrand ? <Badge>Yours</Badge> : undefined,
							}))}
							empty={<p className="oa-quiet">No links were cited in this run.</p>}
						/>
					</CardContent>
				</Card>
				{changes.length > 0 ? (
					<ChangeSummary title="Since the last run" period={previous ? when(previous.startedAt) : ""} changes={changes} />
				) : (
					<Card>
						<CardHeader title="Since the last run" description="What moved between runs shows here after a second run." />
					</Card>
				)}
			</div>
		</Page>
	);
}
