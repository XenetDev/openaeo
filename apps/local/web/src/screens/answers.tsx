import { type AnswerView, AnswerText, type EngineInfo, type ProjectView } from "@openaeo/ui";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { EmptyState } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card-clean";
import { HoverCard } from "@/components/ui/hover-card-clean";
import { MessageActions } from "@/components/ui/message-actions-clean";
import { SegmentedControl } from "@/components/ui/segmented-control-clean";
import { engineLabel, ordinal, Page } from "./shared";

type Props = { answers: AnswerView[]; project: ProjectView; competitors: string[]; engines: EngineInfo[]; filter: string; onFilter: (text: string) => void; onRunAgain: () => void };

export function AnswersScreen({ answers, project, competitors, engines, filter, onFilter, onRunAgain }: Props) {
	const [engine, setEngine] = useState("all");
	const ids = [...new Set(answers.map((a) => a.engine))];
	const shown = answers.filter((a) => (engine === "all" || a.engine === engine) && (!filter || a.promptText === filter));
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
				<EmptyState icon={BubbleChatIcon} title="No answers yet" text="Answers appear here after your first run, with every brand mention marked and every cited link listed." />
			) : shown.length === 0 ? (
				<EmptyState bare icon={BubbleChatIcon} title="No answers match" text="Try another engine or show all questions." />
			) : (
				shown.map((answer) => (
					<Card key={answer.id}>
						<CardHeader
							title={answer.promptText}
							description={
								answer.errorCode !== null ? "This engine could not answer." : answer.searched ? `${engineLabel(engines, answer.engine)} searched the web for this answer` : `${engineLabel(engines, answer.engine)} answered without searching the web`
							}
							action={
								<span className="oa-inline">
									<Badge>{engineLabel(engines, answer.engine)}</Badge>
									{answer.errorCode !== null ? (
										<Badge tone="danger">Failed</Badge>
									) : answer.brandRank === null ? (
										<Badge tone="warning">Not mentioned</Badge>
									) : (
										<Badge tone="success">Mentioned {ordinal(answer.brandRank)}</Badge>
									)}
									{answer.brandCited ? <Badge tone="info">Your site cited</Badge> : null}
									{answer.sentiment ? <Badge>{answer.sentiment} tone</Badge> : null}
								</span>
							}
						/>
						<CardContent>
							{answer.errorCode !== null ? (
								<>
									<p className="oa-quiet">{answer.errorMessage ?? "No reason was given."}</p>
									<Button variant="secondary" size="sm" style={{ marginTop: 12 }} onClick={onRunAgain}>
										Run again
									</Button>
								</>
							) : (
								<div data-ui-message>
									<AnswerText text={answer.text} brand={[project.name, ...project.aliases]} others={competitors} />
									<MessageActions text={answer.text} actions={["copy"]} quiet />
								</div>
							)}
						</CardContent>
						{answer.errorCode === null && answer.citations.length > 0 ? (
							<CardFooter>
								<span className="oa-inline">
									{answer.citations.slice(0, 12).map((c, i) => (
										<HoverCard
											key={`${c.url}-${i}`}
											width={280}
											content={
												<div>
													<strong>{c.title ?? c.domain}</strong>
													<p className="oa-quiet" style={{ overflowWrap: "anywhere" }}>
														{c.url}
													</p>
												</div>
											}
										>
											{/^https?:\/\//i.test(c.url) ? (
												<a href={c.url} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "none" }}>
													<Badge>{c.domain}</Badge>
												</a>
											) : (
												<span>
													<Badge>{c.domain}</Badge>
												</span>
											)}
										</HoverCard>
									))}
									{answer.citations.length > 12 ? <Badge>+{answer.citations.length - 12} more</Badge> : null}
								</span>
							</CardFooter>
						) : null}
					</Card>
				))
			)}
		</Page>
	);
}
