import type { EngineInfo, ProjectView } from "@openaeo/ui";
import { AiChat02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef } from "react";
import { EmptyState } from "@/components/app-shell";
import { AIAnswer } from "@/components/ui/ai-answer-clean";
import { Avatar } from "@/components/ui/avatar-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { ChatComposer } from "@/components/ui/chat-composer-clean";
import { toast } from "@/components/ui/toaster-clean";
import { toAnswerMarkup } from "./answer-markup";
import { engineLabel, Page } from "./shared";

export type Turn = { id: string; role: "user" | "assistant"; text: string; engine?: string; pending?: boolean; failed?: boolean };

type Props = { project: ProjectView; engines: EngineInfo[]; turns: Turn[]; onAsk: (question: string, engine: string) => void; onClear: () => void };

const STARTERS = [
	"Why am I not being named, and what should I do first?",
	"Which sites should I try to get mentioned on?",
	"Which competitor is ahead of me, and on which questions?",
	"What should I fix on my website first?",
];

export function AskScreen({ project, engines, turns, onAsk, onClear }: Props) {
	const ready = engines.filter((e) => e.available && e.enabled);
	const models = useMemo(() => ready.map((e) => ({ id: e.id, name: e.label, Logo: () => <Avatar kind="agent" name={e.label} seed={e.id} size={20} /> })), [ready.map((e) => e.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
	const brand = useMemo(() => [project.name, ...project.aliases], [project]);
	const busy = turns.some((t) => t.pending);
	const end = useRef<HTMLDivElement>(null);
	const picked = useRef(ready[0]?.id ?? "");
	const last = turns[turns.length - 1];

	useEffect(() => {
		end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
	}, [turns.length, last?.pending]);

	const retry = [...turns].reverse().find((t) => t.role === "user")?.text;

	return (
		<Page
			brand={project.name}
			title="Ask OpenAEO"
			actions={
				turns.length > 0 && !busy ? (
					<Button variant="ghost" size="sm" onClick={onClear}>
						New chat
					</Button>
				) : undefined
			}
		>
			<div className="oa-ask">
				{turns.length === 0 ? (
					<div className="oa-ask-start">
						<EmptyState bare icon={AiChat02Icon} title={`Ask about ${project.name}'s results`} text="Answers are written from your own runs and site audit, not from the web. Nothing here is saved." />
						{ready.length > 0 ? (
							<div className="oa-ask-starters">
								{STARTERS.map((text) => (
									<Button key={text} variant="secondary" onClick={() => onAsk(text, picked.current)}>
										{text}
									</Button>
								))}
							</div>
						) : null}
					</div>
				) : (
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
											<Button variant="secondary" size="sm" onClick={() => onAsk(retry, picked.current)}>
												Try again
											</Button>
										</CardContent>
									) : null}
								</Card>
							) : (
								<AIAnswer
									key={turn.id}
									className="oa-reply"
									sources={[]}
									answer={turn.pending ? "" : toAnswerMarkup(turn.text, [], brand).answer}
									streaming={turn.pending}
									onCopy={() => toast.success("Answer copied")}
								/>
							),
						)}
						<div ref={end} />
					</div>
				)}

				<div className="oa-ask-dock">
					{ready.length === 0 ? (
						<Card>
							<CardHeader title="No AI engine is ready" description="Ask OpenAEO uses your own Claude Code or Codex. Install and sign in to one, then check Settings." />
						</Card>
					) : (
						<>
							<ChatComposer
								plain
								tray={false}
								busy={busy}
								placeholder={turns.length ? "Ask a follow-up…" : "Ask about your visibility, competitors or site…"}
								models={models}
								onModelChange={(model) => {
									picked.current = model.id;
								}}
								onSend={(message, details) => onAsk(message, details.model || picked.current)}
							/>
							<p className="oa-quiet oa-ask-note">
								Written by {engineLabel(engines, last?.engine ?? picked.current)} on your own subscription, from your OpenAEO data only.
							</p>
						</>
					)}
				</div>
			</div>
		</Page>
	);
}
