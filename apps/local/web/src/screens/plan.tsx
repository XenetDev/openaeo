import type { PageId, PlanStepView, PlanView, ProjectView } from "@api";
import {
	AiChat02Icon,
	ArrowRight02Icon,
	CheckmarkCircle02Icon,
	Flag02Icon,
	LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { EmptyState, Icon } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { HighMark, LowMark, MediumMark } from "./command-icons";
import { Page } from "./shared";

type Props = {
	project: ProjectView;
	plan: PlanView;
	hasRun: boolean;
	onDone: (step: string, done: boolean) => void;
	onAsk: (question: string) => void;
	onNavigate: (page: PageId) => void;
};

const MARKS: Record<PlanStepView["severity"], ReactNode> = {
	high: <HighMark />,
	medium: <MediumMark />,
	low: <LowMark />,
};
const PAGE_LABEL: Partial<Record<PageId, string>> = {
	answers: "Read the answers",
	sources: "Open Sources",
	audit: "Open the Audit",
};
const LONG = 40;

function Step({
	step,
	number,
	onDone,
	onAsk,
	onNavigate,
}: { step: PlanStepView; number: number } & Pick<Props, "onDone" | "onAsk" | "onNavigate">) {
	return (
		<Card className="oa-step" data-done={step.done || undefined}>
			<CardHeader
				icon={MARKS[step.severity]}
				title={`${number}. ${step.title}`}
				description={step.why}
				action={
					<>
						{step.done ? <Badge tone="success">Done</Badge> : null}
						{step.ask ? (
							<Button size="sm" onClick={() => onAsk(step.ask as string)} icon={<Icon icon={AiChat02Icon} size={14} />}>
								Ask Aeo to help
							</Button>
						) : null}
						{step.page && PAGE_LABEL[step.page] ? (
							<Button
								variant="secondary"
								size="sm"
								onClick={() => onNavigate(step.page as PageId)}
								iconRight={<Icon icon={ArrowRight02Icon} size={14} />}
							>
								{PAGE_LABEL[step.page]}
							</Button>
						) : null}
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onDone(step.id, !step.done)}
							icon={<Icon icon={CheckmarkCircle02Icon} size={14} />}
						>
							{step.done ? "Mark as not done" : "Mark as done"}
						</Button>
					</>
				}
			/>
			<CardContent>
				<div className="oa-step-body">
					{step.evidence.length > 0 ? (
						step.evidence.some((item) => item.length > LONG) ? (
							<ul>
								{step.evidence.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						) : (
							<span className="oa-inline">
								{step.evidence.map((item) => (
									<Badge key={item}>{item}</Badge>
								))}
							</span>
						)
					) : null}
					<section>
						<small>What to do</small>
						<ol>
							{step.how.map((line) => (
								<li key={line}>{line}</li>
							))}
						</ol>
					</section>
					{step.links.length > 0 ? (
						<section>
							<small>Where</small>
							<span className="oa-inline">
								{step.links.map((link) => (
									<a key={link.url} className="oa-step-link" href={link.url} target="_blank" rel="noreferrer">
										{link.label}
										<Icon icon={LinkSquare02Icon} size={12} />
									</a>
								))}
							</span>
						</section>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

export function PlanScreen({ project, plan, hasRun, onDone, onAsk, onNavigate }: Props) {
	const total = plan.steps.length;
	return (
		<Page
			brand={project.name}
			title="Plan"
			actions={
				total > 0 ? (
					<Badge tone={plan.done === total ? "success" : "info"}>{`${plan.done} of ${total} done`}</Badge>
				) : undefined
			}
		>
			{total === 0 ? (
				<EmptyState
					icon={Flag02Icon}
					title={hasRun ? "Nothing to fix right now" : "Your plan appears after the first run"}
					text={
						hasRun
							? `The engines name ${project.name}, know what it is and raised no doubts. Run again after changes to keep it that way.`
							: `A run asks the engines your buyers' questions and what they know about ${project.name}. The plan is built from what they say.`
					}
					action={
						hasRun ? undefined : (
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
			) : (
				<>
					<Card>
						<CardHeader
							title={`How to get AI to recommend ${project.name}`}
							description="Built from your latest run: what the engines said about you, who they named instead, and the sites they relied on. Most important first. Run again after each change to see what moved."
						/>
						<CardContent>
							<span className="oa-progress" role="img" aria-label={`${plan.done} of ${total} steps done`}>
								<i style={{ width: `${(plan.done / total) * 100}%` }} />
							</span>
						</CardContent>
					</Card>
					{plan.steps.map((step, index) => (
						<Step key={step.id} step={step} number={index + 1} onDone={onDone} onAsk={onAsk} onNavigate={onNavigate} />
					))}
				</>
			)}
		</Page>
	);
}
