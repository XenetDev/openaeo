import { type AnswerView, AnswerText, type EngineInfo, type ProjectView } from "@openaeo/ui";
import { useState } from "react";
import { EmptyState } from "@/components/app-shell";
import { engineLabel, Head, ordinal } from "./shared";

type Props = { answers: AnswerView[]; project: ProjectView; competitors: string[]; engines: EngineInfo[]; filter: string; onFilter: (text: string) => void };

export function AnswersScreen({ answers, project, competitors, engines, filter, onFilter }: Props) {
	const [engine, setEngine] = useState("all");
	const ids = [...new Set(answers.map((a) => a.engine))];
	const shown = answers.filter((a) => (engine === "all" || a.engine === engine) && (!filter || a.promptText === filter));
	return (
		<div className="oa-view">
			<Head
				section="Answers"
				title="What each engine said"
				sub={
					filter ? (
						<>
							Showing answers to “{filter}”.{" "}
							<button type="button" className="oa-plain" onClick={() => onFilter("")}>
								Show all
							</button>
						</>
					) : (
						"Your brand is highlighted in green; competitors are underlined."
					)
				}
				actions={
					ids.length > 1 ? (
						<div className="oa-seg" role="group" aria-label="Engine">
							{["all", ...ids].map((id) => (
								<button key={id} type="button" aria-pressed={engine === id} onClick={() => setEngine(id)}>
									{id === "all" ? "All engines" : engineLabel(engines, id)}
								</button>
							))}
						</div>
					) : undefined
				}
			/>
			{answers.length === 0 ? (
				<EmptyState title="No answers yet" text="Answers appear here after your first run, with every brand mention highlighted and every cited link listed." />
			) : (
				shown.map((answer) => (
					<article key={answer.id} className="oa-card">
						<header className="oa-answer-head">
							<h2 className="oa-answer-q">{answer.promptText}</h2>
							<span className="oa-tag">{engineLabel(engines, answer.engine)}</span>
							{answer.errorCode === null ? (
								<>
									<span className="oa-tag" data-tone={answer.brandRank === null ? "bad" : "you"}>
										{answer.brandRank === null ? "Not mentioned" : `Mentioned ${ordinal(answer.brandRank)}`}
									</span>
									{answer.brandCited ? (
										<span className="oa-tag" data-tone="good">
											Your site cited
										</span>
									) : null}
									{answer.sentiment ? <span className="oa-tag">{answer.sentiment} tone</span> : null}
								</>
							) : (
								<span className="oa-tag" data-tone="bad">
									Failed
								</span>
							)}
						</header>
						{answer.errorCode !== null ? (
							<p className="oa-alert" style={{ marginBottom: 0 }}>
								{answer.errorMessage ?? "This engine could not answer."}
							</p>
						) : (
							<>
								<AnswerText text={answer.text} brand={[project.name, ...project.aliases]} others={competitors} />
								{answer.citations.length > 0 ? (
									<ul className="oa-cites">
										{answer.citations.map((c, i) => (
											<li key={`${c.url}-${i}`}>
												{/^https?:\/\//i.test(c.url) ? (
													<a href={c.url} target="_blank" rel="noreferrer noopener" title={c.title ?? c.url}>
														{c.domain}
													</a>
												) : (
													<span>{c.domain}</span>
												)}
											</li>
										))}
									</ul>
								) : (
									<p className="oa-note">{answer.searched ? "No links in this answer." : "Answered without searching the web."}</p>
								)}
							</>
						)}
					</article>
				))
			)}
		</div>
	);
}
