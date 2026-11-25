import type { AnswerView, EngineView, ProjectView, ReportView, RunView } from "@api";
import { ArrowRight02Icon, Clock01Icon, PlayIcon, StopIcon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { EmptyState, Icon } from "@/components/app-shell";
import { Badge, type BadgeTone } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { Select } from "@/components/ui/select-clean";
import { type TraceSpan, TraceWaterfall } from "@/components/ui/trace-waterfall-clean";
import { api } from "../api";
import { runtime } from "../runtime";
import { words } from "../wording";
import { runTree } from "./run-tree";
import { EngineLogo, engineLabel, Facts, Page, percent, span, when } from "./shared";

type Props = {
	project: ProjectView;
	engines: EngineView[];
	report: ReportView;
	schedule: string;
	onSchedule: (value: string, label: string) => void;
	onStart: () => void;
	onCancel: () => void;
	onOpenAnswers: () => void;
};

const SCHEDULES = [
	{ value: "off", label: "Only when I press Run now", description: "Nothing runs on its own" },
	{ value: "daily", label: "Once a day", description: words.scheduleNote },
	{ value: "weekly", label: "Once a week", description: words.scheduleNote },
].filter((option) => runtime.schedules.includes(option.value));
const PERIOD: Record<string, number> = { daily: 86_400_000, weekly: 7 * 86_400_000 };
const STATUS: Record<RunView["status"], { label: string; tone: BadgeTone }> = {
	running: { label: "Running", tone: "info" },
	done: { label: "Done", tone: "success" },
	interrupted: { label: "Stopped early", tone: "warning" },
};

const withMarks = (root: TraceSpan): TraceSpan => ({
	...root,
	children: root.children?.map((child) => ({ ...child, icon: <EngineLogo engine={child.id} label={child.name} /> })),
});

export function RunsScreen({
	project,
	engines,
	report,
	schedule,
	onSchedule,
	onStart,
	onCancel,
	onOpenAnswers,
}: Props) {
	const [runs, setRuns] = useState<RunView[] | null>(null);
	const [picked, setPicked] = useState<string | null>(null);
	const [detail, setDetail] = useState<{ run: RunView; answers: AnswerView[] } | null>(null);
	const latest = report.run;
	const beat = `${latest?.id}:${latest?.status}:${latest?.completed}`;
	const selected = runs?.find((r) => r.id === picked)?.id ?? runs?.[0]?.id ?? null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: beat changes whenever the latest run moves on
	useEffect(() => {
		let stale = false;
		void api.runs(project.id).then(
			(result) => !stale && setRuns(result.runs),
			() => !stale && setRuns([]),
		);
		return () => {
			stale = true;
		};
	}, [project.id, beat]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: beat changes whenever the latest run moves on
	useEffect(() => {
		if (!selected) return setDetail(null);
		let stale = false;
		void api.run(selected).then(
			(result) => !stale && setDetail(result),
			() => {},
		);
		return () => {
			stale = true;
		};
	}, [selected, beat]);

	const live = latest?.status === "running";
	const period = PERIOD[schedule];
	const next = period && latest ? latest.startedAt + period : null;
	const shown = detail && detail.run.id === selected ? detail : null;
	const trend = new Map(report.trend.map((t) => [t.runId, t]));
	const point = shown ? trend.get(shown.run.id) : undefined;
	const failed = shown?.answers.filter((a) => a.errorCode !== null).length ?? 0;

	return (
		<Page
			brand={project.name}
			title="Runs"
			actions={
				live ? (
					<Button variant="secondary" size="sm" onClick={onCancel} icon={<Icon icon={StopIcon} size={14} />}>
						Stop run
					</Button>
				) : (
					<Button size="sm" onClick={onStart} icon={<Icon icon={PlayIcon} size={14} />}>
						Run now
					</Button>
				)
			}
		>
			{runs === null ? null : runs.length === 0 ? (
				<EmptyState
					icon={Clock01Icon}
					title="No runs yet"
					text="A run asks every AI engine each of your questions once. Every run is kept here, so you can see how the answers change over time."
					action={
						<Button variant="secondary" size="sm" onClick={onStart} icon={<Icon icon={PlayIcon} size={14} />}>
							Run now
						</Button>
					}
				/>
			) : (
				<div className="oa-answers" data-wide="">
					<Card className="oa-qlist">
						<CardHeader
							title="History"
							description={`${runs.length} ${runs.length === 1 ? "run" : "runs"}, newest first`}
						/>
						<nav aria-label="Runs">
							{runs.map((run) => (
								<button
									key={run.id}
									type="button"
									className="oa-q"
									aria-current={run.id === selected || undefined}
									onClick={() => setPicked(run.id)}
								>
									<span>
										{when(run.startedAt)}
										<small>
											{run.completed} of {run.total} answers
											{trend.has(run.id) ? ` · visibility ${Math.round(trend.get(run.id)?.visibility ?? 0)}` : ""}
										</small>
									</span>
									<Badge tone={STATUS[run.status].tone} live={run.status === "running"}>
										{STATUS[run.status].label}
									</Badge>
								</button>
							))}
						</nav>
					</Card>

					<div className="oa-answer-main">
						{shown ? (
							shown.answers.length === 0 ? (
								<EmptyState
									icon={Clock01Icon}
									title={shown.run.status === "running" ? "Waiting for the first answer" : "This run has no answers"}
									text={
										shown.run.status === "running"
											? "Each answer shows here as it arrives."
											: "It was stopped before any engine answered."
									}
								/>
							) : (
								<TraceWaterfall
									className="oa-trace"
									title="Timeline"
									root={withMarks(runTree(shown.run, shown.answers, (id) => engineLabel(engines, id)))}
									startedAt={shown.run.status === "running" ? shown.run.startedAt : undefined}
								/>
							)
						) : null}
					</div>

					<aside className="oa-answer-rail">
						{shown ? (
							<Card>
								<CardHeader
									title="This run"
									description={when(shown.run.startedAt)}
									action={<Badge tone={STATUS[shown.run.status].tone}>{STATUS[shown.run.status].label}</Badge>}
								/>
								<CardContent>
									<Facts
										rows={[
											["Answers", `${shown.run.completed} of ${shown.run.total}${failed ? `, ${failed} failed` : ""}`],
											[
												"Took",
												shown.run.finishedAt ? span(shown.run.finishedAt - shown.run.startedAt) : "Still running",
											],
											...(point
												? ([
														["Visibility score", String(Math.round(point.visibility))],
														["Named in", `${percent(point.mentionRate)} of answers`],
													] as [string, string][])
												: []),
										]}
									/>
									{shown.run.id === latest?.id ? (
										<Button
											variant="secondary"
											size="sm"
											style={{ marginTop: 12 }}
											onClick={onOpenAnswers}
											iconRight={<Icon icon={ArrowRight02Icon} size={14} />}
										>
											Read the answers
										</Button>
									) : null}
								</CardContent>
							</Card>
						) : null}
						<Card>
							<CardHeader title="Schedule" description={words.schedule} />
							<CardContent>
								<Select
									aria-label="Run schedule"
									options={SCHEDULES}
									value={schedule}
									onChange={(value, option) => onSchedule(value, String(option.label))}
								/>
								<p className="oa-quiet" style={{ marginTop: 10 }}>
									{next
										? next <= Date.now()
											? "The next run starts within a minute."
											: `Next run: ${when(next)}.`
										: period
											? "The schedule starts after your first run."
											: "Nothing runs on its own."}
								</p>
							</CardContent>
						</Card>
					</aside>
				</div>
			)}
		</Page>
	);
}
