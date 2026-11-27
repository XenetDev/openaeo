import type { AskAction, EngineView, ProjectView } from "@api";
import {
	Add01Icon,
	AiChat02Icon,
	ArrowRight02Icon,
	Calendar03Icon,
	CheckListIcon,
	CheckmarkCircle02Icon,
	News01Icon,
	PlayIcon,
	Refresh01Icon,
	Search01Icon,
	Settings01Icon,
	UserAdd01Icon,
	UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, Icon } from "@/components/app-shell";
import { AssistantStart } from "@/components/assistant-start";
import { PillButton, PillField } from "@/components/pill-field";
import { AIAnswer } from "@/components/ui/ai-answer-clean";
import { ApprovalCard } from "@/components/ui/approval-card-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { DropdownMenu } from "@/components/ui/dropdown-menu-clean";
import { ThinkingState } from "@/components/ui/thinking-state-clean";
import { toast } from "@/components/ui/toaster-clean";
import { HOST_PLACES } from "../host";
import { words } from "../wording";
import { toAnswerMarkup } from "./answer-markup";
import { type AskFacts, thinkingSteps } from "./ask-steps";
import { EngineLogo, engineLabel, Page } from "./shared";

export type Turn = {
	id: string;
	role: "user" | "assistant";
	text: string;
	engine?: string;
	pending?: boolean;
	failed?: boolean;
	took?: number;
	actions?: AskAction[];
	/** A short status line from the app itself, not an engine answer */
	note?: boolean;
};

type Props = {
	project: ProjectView;
	engines: EngineView[];
	facts: AskFacts;
	turns: Turn[];
	onAsk: (question: string, engine: string) => void;
	onClear: () => void;
	onAction: (action: AskAction) => unknown;
	onDecline: (action: AskAction) => void;
};

const STARTERS = [
	{
		label: "Why am I not named?",
		icon: Search01Icon,
		question: "Why am I not being named, and what should I do first?",
	},
	{ label: "Where to get mentioned", icon: News01Icon, question: "Which sites should I try to get mentioned on?" },
	{
		label: "Who is ahead of me?",
		icon: UserMultipleIcon,
		question: "Which competitor is ahead of me, and on which questions?",
	},
	{ label: "What to fix first", icon: CheckListIcon, question: "What should I fix on my website first?" },
];

const PAGE_NAMES: Record<string, string> = {
	overview: "Overview",
	prompts: "Prompts",
	answers: "Answers",
	sources: "Sources",
	competitors: "Competitors",
	opportunities: "Opportunities",
	audit: "Audit",
	runs: "Runs",
	settings: "Settings",
};
const placeName = (place: string) => HOST_PLACES.find((item) => item.id === place)?.label ?? PAGE_NAMES[place] ?? place;

type Change = Extract<AskAction, { type: "schedule" | "competitor" | "step" }>;
const isChange = (action: AskAction): action is Change =>
	action.type === "schedule" || action.type === "competitor" || action.type === "step";

const SCHEDULES: Record<string, { title: string; text: string }> = {
	off: { title: "Turn off automatic runs", text: "Runs only start when you press Run now." },
	daily: { title: "Run every day", text: "Every engine is asked every active question once a day." },
	weekly: { title: "Run every week", text: "Every engine is asked every active question once a week." },
};

const CHANGE_ICONS = {
	schedule: Calendar03Icon,
	competitor: UserAdd01Icon,
	step: CheckmarkCircle02Icon,
} as const;

function changeCopy(action: Change, brand: string): { title: string; text: string; value: string } {
	if (action.type === "schedule") {
		const copy = SCHEDULES[action.value] ?? { title: `Set runs to ${action.value}`, text: "" };
		return { ...copy, value: action.value };
	}
	if (action.type === "competitor")
		return {
			title: `Track ${action.name} as a competitor`,
			text: `Counted against ${brand} from the next run.`,
			value: action.name,
		};
	return { title: "Mark this plan step done", text: action.title, value: action.title };
}

const actionLabel = (action: AskAction) =>
	action.type === "run"
		? "Run now"
		: action.type === "audit"
			? "Check my website"
			: action.type === "open"
				? `Open ${placeName(action.page)}`
				: action.type === "track"
					? `Track “${action.question}”`
					: "";

export function AskScreen({ project, engines, facts, turns, onAsk, onClear, onAction, onDecline }: Props) {
	const ready = engines.filter((e) => e.available && e.enabled);
	const brand = useMemo(() => [project.name, ...project.aliases], [project]);
	const busy = turns.some((t) => t.pending);
	const end = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState("");
	const [pickedEngine, setPickedEngine] = useState("");
	const engine = ready.some((e) => e.id === pickedEngine) ? pickedEngine : (ready[0]?.id ?? "");
	const picked = { current: engine };
	const last = turns[turns.length - 1];
	const fresh = useRef(new Set<string>());
	for (const turn of turns) if (turn.pending) fresh.current.add(turn.id);

	const opened = useRef(new Set<string>());
	// biome-ignore lint/correctness/useExhaustiveDependencies: opens a place once, when the reply that asked for it arrives
	useEffect(() => {
		if (!last || last.pending || !fresh.current.has(last.id) || opened.current.has(last.id)) return;
		const go = last.actions?.find((action) => action.type === "open" && action.auto);
		if (!go) return;
		opened.current.add(last.id);
		void onAction(go);
	}, [last?.id, last?.pending]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when a turn is added or finishes
	useEffect(() => {
		end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
	}, [turns.length, last?.pending]);

	const send = () => {
		const text = draft.trim();
		if (!text || busy) return;
		onAsk(text, engine);
		setDraft("");
	};
	const composer = (
		<PillField
			icon={AiChat02Icon}
			label="Message"
			value={draft}
			onChange={setDraft}
			onSubmit={send}
			placeholder={turns.length ? "Ask a follow-up…" : "Ask about your visibility, competitors or site…"}
			extra={
				ready.length > 1 ? (
					<DropdownMenu
						align="end"
						trigger={({ triggerProps }) => (
							<button
								type="button"
								className="oa-pill-pick"
								{...triggerProps}
								aria-label={`Engine: ${engineLabel(engines, engine)}`}
							>
								<EngineLogo engine={engine} label={engineLabel(engines, engine)} size={16} />
								{engineLabel(engines, engine)}
							</button>
						)}
						items={ready.map((e) => ({
							label: e.label,
							logo: <EngineLogo engine={e.id} label={e.label} size={16} />,
							checked: e.id === engine,
							onSelect: () => setPickedEngine(e.id),
						}))}
					/>
				) : null
			}
			action={<PillButton label="Ask Aeo" disabled={!draft.trim() || busy} onClick={send} />}
		/>
	);
	const retry = [...turns].reverse().find((t) => t.role === "user")?.text;

	return (
		<Page
			brand={project.name}
			title="Ask Aeo"
			actions={
				turns.length > 0 && !busy ? (
					<Button variant="ghost" size="sm" onClick={onClear} icon={<Icon icon={Add01Icon} size={14} />}>
						New chat
					</Button>
				) : undefined
			}
		>
			{ready.length === 0 ? (
				<EmptyState
					icon={AiChat02Icon}
					title="No AI engine is ready"
					text={words.askNoEngine}
					action={
						<Button
							variant="secondary"
							size="sm"
							onClick={() => onAction({ type: "open", page: "settings" })}
							icon={<Icon icon={Settings01Icon} size={14} />}
						>
							Open Settings
						</Button>
					}
				/>
			) : turns.length === 0 ? (
				<div className="oa-ask-glow">
					<AssistantStart
						title={`What do you want to know about ${project.name}?`}
						composer={composer}
						chips={STARTERS.map((s) => ({
							label: s.label,
							icon: s.icon,
							onSelect: () => onAsk(s.question, picked.current),
						}))}
						note={<p className="oa-quiet oa-ask-note">{words.askSource} Chats are not saved.</p>}
					/>
				</div>
			) : (
				<div className="oa-ask">
					<div className="oa-thread" aria-live="polite">
						{turns.map((turn) =>
							turn.role === "user" ? (
								<p key={turn.id} className="oa-said" dir="auto">
									{turn.text}
								</p>
							) : turn.failed ? (
								<Card key={turn.id}>
									<CardHeader title="That question could not be answered" description={turn.text} />
									{retry && turn === last ? (
										<CardContent>
											<Button
												variant="secondary"
												size="sm"
												onClick={() => onAsk(retry, picked.current)}
												icon={<Icon icon={Refresh01Icon} size={14} />}
											>
												Try again
											</Button>
										</CardContent>
									) : null}
								</Card>
							) : turn.pending ? (
								<ThinkingState
									key={turn.id}
									hold
									stepMs={900}
									steps={thinkingSteps(retry ?? "", turn.engine ? engineLabel(engines, turn.engine) : "", facts).map(
										(label) => ({ kind: "step", label }),
									)}
								/>
							) : (
								<Fragment key={turn.id}>
									<AIAnswer
										className={turn.note ? "oa-reply oa-reply-note" : "oa-reply"}
										sources={[]}
										answer={toAnswerMarkup(turn.text, [], brand).answer}
										animate={turn === last && fresh.current.has(turn.id)}
										tookSeconds={turn.took}
										onCopy={() => toast.success("Answer copied")}
									/>
									{turn.actions?.some((action) => !isChange(action)) ? (
										<div className="oa-actions">
											{turn.actions
												.filter((action) => !isChange(action))
												.map((action) => (
													<Button
														key={JSON.stringify(action)}
														variant="secondary"
														size="sm"
														icon={
															action.type === "open" ? undefined : (
																<Icon
																	icon={
																		action.type === "run"
																			? PlayIcon
																			: action.type === "audit"
																				? CheckListIcon
																				: Add01Icon
																	}
																	size={14}
																/>
															)
														}
														iconRight={action.type === "open" ? <Icon icon={ArrowRight02Icon} size={14} /> : undefined}
														onClick={() => void onAction(action)}
													>
														{actionLabel(action)}
													</Button>
												))}
										</div>
									) : null}
									{turn.actions?.some(isChange) ? (
										<div className="oa-ask-approvals">
											{turn.actions.filter(isChange).map((action) => {
												const copy = changeCopy(action, project.name);
												return (
													<ApprovalCard
														key={JSON.stringify(action)}
														className="oa-ask-approval"
														actions="card"
														icon={<Icon icon={CHANGE_ICONS[action.type]} size={16} />}
														title={copy.title}
														description={copy.text}
														allowAlways={false}
														shortcuts={false}
														approveLabel="Approve"
														denyLabel="Not now"
														onApprove={async () => {
															await onAction(action);
														}}
														onDeny={() => onDecline(action)}
													/>
												);
											})}
										</div>
									) : null}
								</Fragment>
							),
						)}
						<div ref={end} />
					</div>
					<div className="oa-ask-dock">
						{composer}
						<p className="oa-quiet oa-ask-note">
							{words.askBy(engineLabel(engines, last?.engine ?? picked.current))} from your OpenAEO data only.
						</p>
					</div>
				</div>
			)}
		</Page>
	);
}
