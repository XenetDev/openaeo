import type { EngineView, PageId, ProjectView, ReportView } from "@api";
import {
	Analytics01Icon,
	ArrowRight02Icon,
	ChartIncreaseIcon,
	News01Icon,
	PlayIcon,
	StopIcon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { ChartCard } from "@/components/analytics";
import { EmptyState, Icon } from "@/components/app-shell";
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
	engines: EngineView[];
	loading: boolean;
	onRun: () => void;
	onCancel: () => void;
	onNavigate: (page: PageId) => void;
	filter?: ReactNode;
};

const moved = (
	label: string,
	now: number,
	before: number,
	format: (n: number) => string,
	lowerIsBetter = false,
): MetricChange => {
	if (Math.abs(now - before) < 0.05) return { label, change: `Unchanged at ${format(now)}`, tone: "neutral" };
	const up = now > before;
	return {
		label,
		change: `${up ? "Up" : "Down"} to ${format(now)} from ${format(before)}`,
		tone: up !== lowerIsBetter ? "good" : "bad",
		direction: up ? "up" : "down",
	};
};

export function OverviewScreen({ project, report, engines, loading, onRun, onCancel, onNavigate, filter }: Props) {
	const { run, overall, trend } = report;
	const m = overall.metrics;
	const tone = overall.sentiment;
	const labelled = tone.positive + tone.neutral + tone.negative;
	const running = run?.status === "running";
	const usable = engines.filter((e) => e.available && e.enabled);
	const blocked = engines.filter((e) => !e.available && e.id !== "openai");
	const problems = report.problems ?? [];
	const hasData = m.answers > 0;
	const leader = report.competitors.find((c) => !c.isBrand && c.mentionRate > 0);
	const previous = trend.length > 1 ? trend[trend.length - 2] : undefined;
	const labels = trend.map((t) => day(t.startedAt));
	const spark = (label: string, values: number[]) => {
		const points = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
		return (
			<TrendChart
				variant="sparkline"
				height={36}
				tooltip={false}
				label={`${label} by run`}
				labels={points.map((_, index) => labels[index] ?? "")}
				series={[{ label, values: points, color: "var(--muted)" }]}
			/>
		);
	};
	const stats = [
		{
			label: "Visibility score",
			value: overall.visibility,
			format: (n: number) => n.toFixed(1),
			change: previous ? overall.visibility - previous.visibility : undefined,
			changeFormat: (n: number) => n.toFixed(1),
			series: trend.map((t) => t.visibility),
		},
		{
			label: "Mentioned in",
			value: m.mentionRate * 100,
			format: (n: number) => `${Math.round(n)}%`,
			change: previous ? (m.mentionRate - previous.mentionRate) * 100 : undefined,
			changeFormat: (n: number) => `${Math.round(n)} pts`,
			series: trend.map((t) => t.mentionRate * 100),
		},
		{
			label: "Your site cited in",
			value: m.citationRate * 100,
			format: (n: number) => `${Math.round(n)}%`,
			change: previous ? (m.citationRate - previous.citationRate) * 100 : undefined,
			changeFormat: (n: number) => `${Math.round(n)} pts`,
			series: trend.map((t) => t.citationRate * 100),
		},
		{
			label: "Average position",
			value: m.averageRank ?? "–",
			format: (n: number) => n.toFixed(1),
			change:
				m.averageRank !== null && typeof previous?.averageRank === "number"
					? m.averageRank - previous.averageRank
					: undefined,
			changeFormat: (n: number) => n.toFixed(1),
			lowerIsBetter: true,
			series: trend.flatMap((t) => (t.averageRank === null ? [] : [t.averageRank])),
		},
		{
			label: "Sentiment",
			value: tone.score ?? "–",
			format: (n: number) => `${Math.round(n)}`,
			change:
				tone.score !== null && typeof previous?.sentiment === "number" ? tone.score - previous.sentiment : undefined,
			changeFormat: (n: number) => `${Math.round(n)} pts`,
			series: trend.flatMap((t) => (t.sentiment === null ? [] : [t.sentiment])),
		},
	];

	const actions =
		running && run ? (
			<>
				<Badge tone="info" live>
					Asking {run.completed} of {run.total}
				</Badge>
				<Button variant="secondary" size="sm" onClick={onCancel} icon={<Icon icon={StopIcon} size={14} />}>
					Stop
				</Button>
			</>
		) : (
			<>
				{filter}
				<Button size="sm" onClick={onRun} disabled={usable.length === 0} icon={<Icon icon={PlayIcon} size={14} />}>
					Run now
				</Button>
			</>
		);

	if (loading) {
		return (
			<Page brand={project.name} title="Overview" actions={actions}>
				<div className="ui-as-rev__stats oa-stats-5">
					{["Visibility score", "Mentioned in", "Your site cited in", "Average position", "Sentiment"].map((label) => (
						<StatCard
							key={label}
							className="ui-as-rev__stat oa-stat"
							label={label}
							value=""
							change={0}
							loading
							chart={<span />}
						/>
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
					<CardHeader
						title="No AI engine can run yet"
						description="OpenAEO uses the AI tools signed in on this computer."
						action={<Badge tone="danger">Needs you</Badge>}
					/>
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
						action={
							<Badge tone={hasData ? "warning" : "danger"}>{problems.reduce((n, p) => n + p.count, 0)} failed</Badge>
						}
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
			{hasData && m.mentionRate === 0 && !running ? (
				<Card>
					<CardHeader
						title={`No AI engine named ${project.name} in this run`}
						description={`${m.answers} answers from ${report.engines.length} ${report.engines.length === 1 ? "engine" : "engines"}${leader ? `. ${leader.name} was named most, in ${percent(leader.mentionRate)} of them` : ""}. Most new brands start here; the figures below are real, not missing.`}
						action={<Badge tone="warning">Not named yet</Badge>}
					/>
					<CardContent>
						<span className="oa-inline">
							<Button
								size="sm"
								onClick={() => onNavigate("opportunities")}
								iconRight={<Icon icon={ArrowRight02Icon} size={14} />}
							>
								See who was named instead
							</Button>
							<Button variant="secondary" size="sm" onClick={() => onNavigate("audit")}>
								Check what AI can read on your site
							</Button>
						</span>
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
								<Button
									variant="secondary"
									size="sm"
									onClick={() => onNavigate("prompts")}
									iconRight={<Icon icon={ArrowRight02Icon} size={14} />}
								>
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
				...(tone.score !== null && typeof previous.sentiment === "number"
					? [moved("Sentiment", tone.score, previous.sentiment, (n) => `${Math.round(n)}`)]
					: []),
			]
		: [];

	return (
		<Page brand={project.name} title="Overview" actions={actions}>
			{notices}
			<div className="ui-as-rev__stats oa-stats-5">
				{stats.map((stat) => (
					<StatCard
						key={stat.label}
						className="ui-as-rev__stat oa-stat"
						label={stat.label}
						value={stat.value}
						format={stat.format}
						change={stat.change}
						changeFormat={stat.changeFormat}
						lowerIsBetter={stat.lowerIsBetter}
						chart={spark(stat.label, stat.series)}
					/>
				))}
			</div>

			<div className="ui-as-rev__row ui-as-rev__row--main">
				<ChartCard
					tall
					title="Visibility over time"
					ceiling={100}
					value={overall.visibility}
					delta={previous ? overall.visibility - previous.visibility : undefined}
					format={(n) => n.toFixed(1)}
					labels={labels}
					tooltipLabels={trend.map((t) => when(t.startedAt))}
					series={[{ label: "Visibility", values: trend.map((t) => t.visibility) }]}
					footer={
						trend.length === 1
							? "One run so far. Each run adds a point."
							: `${trend.length} runs · latest ${run ? when(run.startedAt) : ""}`
					}
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
						{labelled > 0 ? (
							<div className="oa-tone">
								<span className="oa-tone-head">
									<b>Tone when you are named</b>
									<small>
										{tone.positive} positive · {tone.neutral} neutral · {tone.negative} negative
									</small>
								</span>
								<span
									className="oa-tone-bar"
									role="img"
									aria-label={`${tone.positive} positive, ${tone.neutral} neutral, ${tone.negative} negative answers`}
								>
									<i data-tone="positive" style={{ flexGrow: tone.positive }} />
									<i data-tone="neutral" style={{ flexGrow: tone.neutral }} />
									<i data-tone="negative" style={{ flexGrow: tone.negative }} />
								</span>
							</div>
						) : null}
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
								quiet: !c.isBrand,
							}))}
						/>
					</CardContent>
				</Card>
				<Card className="oa-card-fill">
					<CardHeader title="Most cited sites" description="Links in the latest answers" />
					<CardContent>
						<ShareList
							items={report.topDomains.slice(0, 6).map((d) => ({
								label: d.domain,
								value: `${d.citations}`,
								share: (d.citations / Math.max(1, report.topDomains[0]?.citations ?? 1)) * 100,
								badge: d.isBrand ? <Badge>Yours</Badge> : undefined,
								quiet: !d.isBrand,
							}))}
							empty={
								<EmptyState
									bare
									icon={News01Icon}
									title="No links cited"
									text="The engines answered this run without linking to any site."
								/>
							}
						/>
					</CardContent>
				</Card>
				{changes.length > 0 ? (
					<ChangeSummary
						title="Since the last run"
						period={previous ? when(previous.startedAt) : ""}
						changes={changes}
					/>
				) : (
					<Card className="oa-card-fill">
						<CardHeader title="Since the last run" />
						<CardContent>
							<EmptyState
								bare
								icon={ChartIncreaseIcon}
								title="Nothing to compare yet"
								text="After a second run, this shows what went up and what went down."
							/>
						</CardContent>
					</Card>
				)}
			</div>
		</Page>
	);
}
