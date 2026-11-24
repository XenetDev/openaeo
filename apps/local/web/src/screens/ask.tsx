import type { EngineInfo, ProjectView } from "@openaeo/ui";
import { Add01Icon, AiChat02Icon, ArrowRight02Icon, CheckListIcon, News01Icon, PencilEdit02Icon, PlayIcon, Refresh01Icon, Search01Icon, Settings01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, Icon } from "@/components/app-shell";
import { AssistantStart } from "@/components/assistant-start";
import { AIAnswer } from "@/components/ui/ai-answer-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { PillButton, PillField } from "@/components/pill-field";
import { DropdownMenu } from "@/components/ui/dropdown-menu-clean";
import { ThinkingState } from "@/components/ui/thinking-state-clean";
import { toast } from "@/components/ui/toaster-clean";
import type { AskAction } from "../api";
import { toAnswerMarkup } from "./answer-markup";
import { EngineLogo, engineLabel, Page } from "./shared";

export type Turn = { id: string; role: "user" | "assistant"; text: string; engine?: string; pending?: boolean; failed?: boolean; took?: number; actions?: AskAction[] };

type Props = { project: ProjectView; engines: EngineInfo[]; turns: Turn[]; onAsk: (question: string, engine: string) => void; onClear: () => void; onAction: (action: AskAction) => void };

const STARTERS = [
	{ label: "Why am I not named?", icon: Search01Icon, question: "Why am I not being named, and what should I do first?" },
	{ label: "Where to get mentioned", icon: News01Icon, question: "Which sites should I try to get mentioned on?" },
	{ label: "Who is ahead of me?", icon: UserMultipleIcon, question: "Which competitor is ahead of me, and on which questions?" },
	{ label: "What to fix first", icon: CheckListIcon, question: "What should I fix on my website first?" },
];

const PAGE_NAMES: Record<string, string> = { overview: "Overview", prompts: "Prompts", answers: "Answers", sources: "Sources", competitors: "Competitors", opportunities: "Opportunities", audit: "Audit", runs: "Runs", settings: "Settings" };
const actionLabel = (action: AskAction) =>
	action.type === "run" ? "Run now" : action.type === "audit" ? "Check my website" : action.type === "open" ? `Open ${PAGE_NAMES[action.page] ?? action.page}` : `Track “${action.question}”`;

export function AskScreen({ project, engines, turns, onAsk, onClear, onAction }: Props) {
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
							<button type="button" className="oa-pill-pick" {...triggerProps} aria-label={`Engine: ${engineLabel(engines, engine)}`}>
								<EngineLogo engine={engine} label={engineLabel(engines, engine)} size={16} />
								{engineLabel(engines, engine)}
							</button>
						)}
						items={ready.map((e) => ({ label: e.label, logo: <EngineLogo engine={e.id} label={e.label} size={16} />, checked: e.id === engine, onSelect: () => setPickedEngine(e.id) }))}
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
					<Button variant="ghost" size="sm" onClick={onClear} icon={<Icon icon={PencilEdit02Icon} size={14} />}>
						New chat
					</Button>
				) : undefined
			}
		>
			{ready.length === 0 ? (
				<EmptyState
					icon={AiChat02Icon}
					title="No AI engine is ready"
					text="Aeo uses your own Claude Code or Codex. Install and sign in to one, then check Settings."
					action={
						<Button variant="secondary" size="sm" onClick={() => onAction({ type: "open", page: "settings" })} icon={<Icon icon={Settings01Icon} size={14} />}>
							Open Settings
						</Button>
					}
				/>
			) : turns.length === 0 ? (
				<div className="oa-ask-glow">
				<AssistantStart
					title={`What do you want to know about ${project.name}?`}
					composer={composer}
					chips={STARTERS.map((s) => ({ label: s.label, icon: s.icon, onSelect: () => onAsk(s.question, picked.current) }))}
					note={<p className="oa-quiet oa-ask-note">Written by your own Claude or Codex from your runs and site audit, not from the web. Chats are not saved.</p>}
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
											<Button variant="secondary" size="sm" onClick={() => onAsk(retry, picked.current)} icon={<Icon icon={Refresh01Icon} size={14} />}>
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
									steps={[
										{ kind: "step", label: "Reading your latest run and site audit" },
										{ kind: "step", label: `Asking ${engineLabel(engines, turn.engine ?? "")} what it makes of them` },
									]}
								/>
							) : (
								<Fragment key={turn.id}>
									<AIAnswer className="oa-reply" sources={[]} answer={toAnswerMarkup(turn.text, [], brand).answer} animate={turn === last && fresh.current.has(turn.id)} tookSeconds={turn.took} onCopy={() => toast.success("Answer copied")} />
									{turn.actions?.length ? (
										<div className="oa-actions">
											{turn.actions.map((action) => (
												<Button
													key={JSON.stringify(action)}
													variant="secondary"
													size="sm"
													icon={action.type === "open" ? undefined : <Icon icon={action.type === "run" ? PlayIcon : action.type === "audit" ? CheckListIcon : Add01Icon} size={14} />}
													iconRight={action.type === "open" ? <Icon icon={ArrowRight02Icon} size={14} /> : undefined}
													onClick={() => onAction(action)}
												>
													{actionLabel(action)}
												</Button>
											))}
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
							Written by {engineLabel(engines, last?.engine ?? picked.current)} on your own subscription, from your OpenAEO data only.
						</p>
					</div>
				</div>
			)}
		</Page>
	);
}
