import type { AnswerView, EngineInfo, ProjectView } from "@openaeo/ui";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/app-shell";
import { AIAnswer } from "@/components/ui/ai-answer-clean";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { SegmentedControl } from "@/components/ui/segmented-control-clean";
import { toast } from "@/components/ui/toaster-clean";
import { toAnswerMarkup } from "./answer-markup";
import { engineLabel, ordinal, Page } from "./shared";

type Props = { answers: AnswerView[]; project: ProjectView; engines: EngineInfo[]; filter: string; onFilter: (text: string) => void; onRunAgain: () => void };

function Verdict({ answer }: { answer: AnswerView }) {
	if (answer.errorCode !== null) return <Badge tone="danger">Failed</Badge>;
	return (
		<>
			{answer.brandRank === null ? <Badge tone="warning">Not mentioned</Badge> : <Badge tone="success">Mentioned {ordinal(answer.brandRank)}</Badge>}
			{answer.brandCited ? <Badge tone="info">Your site cited</Badge> : null}
			{answer.sentiment ? <Badge>{answer.sentiment} tone</Badge> : null}
			<Badge>{answer.searched ? "Searched the web" : "From memory"}</Badge>
		</>
	);
}

export function AnswersScreen({ answers, project, engines, filter, onFilter, onRunAgain }: Props) {
	const [engine, setEngine] = useState("all");
	const ids = [...new Set(answers.map((a) => a.engine))];
	const brand = useMemo(() => [project.name, ...project.aliases], [project]);
	const shown = answers.filter((a) => (engine === "all" || a.engine === engine) && (!filter || a.promptText === filter));
	const questions = [...new Set(shown.map((a) => a.promptText))];

	return (
		<Page
			brand={project.name}
			title="Answers"
			actions={
				<>
					{filter ? (
						<Button variant="ghost" size="sm" onClick={() => onFilter("")}>
							Show all questions
						</Button>
					) : null}
					{ids.length > 1 ? (
						<SegmentedControl
							aria-label="Engine"
							size="sm"
							value={engine}
							onChange={setEngine}
							options={[{ value: "all", label: "All engines" }, ...ids.map((id) => ({ value: id, label: engineLabel(engines, id) }))]}
						/>
					) : null}
				</>
			}
		>
			{answers.length === 0 ? (
				<EmptyState icon={BubbleChatIcon} title="No answers yet" text="Answers appear here after your first run, side by side for each engine, with their sources." />
			) : shown.length === 0 ? (
				<EmptyState bare icon={BubbleChatIcon} title="No answers match" text="Try another engine or show all questions." />
			) : (
				questions.map((question) => {
					const group = shown.filter((a) => a.promptText === question);
					const good = group.filter((a) => a.errorCode === null);
					const mentioned = good.filter((a) => a.brandRank !== null).length;
					return (
						<section key={question} className="oa-question">
							<header className="oa-question-head">
								<h2>{question}</h2>
								<Badge tone={good.length === 0 ? "danger" : mentioned === good.length ? "success" : mentioned === 0 ? "warning" : "neutral"}>
									{good.length === 0 ? "No answers" : `${project.name} mentioned by ${mentioned} of ${good.length} ${good.length === 1 ? "engine" : "engines"}`}
								</Badge>
							</header>
							<div className={group.length > 1 ? "oa-cols-2" : "oa-stack"}>
								{group.map((answer) => {
									const label = engineLabel(engines, answer.engine);
									if (answer.errorCode !== null) {
										return (
											<Card key={answer.id}>
												<CardHeader title={label} description="This engine could not answer." action={<Verdict answer={answer} />} />
												<CardContent>
													<p className="oa-quiet">{answer.errorMessage ?? "No reason was given."}</p>
													<Button variant="secondary" size="sm" style={{ marginTop: 12 }} onClick={onRunAgain}>
														Run again
													</Button>
												</CardContent>
											</Card>
										);
									}
									const markup = toAnswerMarkup(answer.text, answer.citations, brand);
									return (
										<div key={answer.id} className="oa-answer">
											<span className="oa-inline">
												<Verdict answer={answer} />
											</span>
											<AIAnswer framed question={label} sources={markup.sources} answer={markup.answer} animate={false} tookSeconds={answer.durationMs / 1000} onCopy={() => toast.success("Answer copied")} />
										</div>
									);
								})}
							</div>
						</section>
					);
				})
			)}
		</Page>
	);
}
