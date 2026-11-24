"use client";
import { useState } from "react";
import { AnswerText } from "./AnswerText";
import { engineLabel, isHttp, ordinal } from "./format";
import type { AnswerView, EngineInfo, ProjectView } from "./types";

export type AnswersPageProps = { answers: AnswerView[]; project: ProjectView; competitors: string[]; engines: EngineInfo[] };

export function AnswersPage({ answers, project, competitors, engines }: AnswersPageProps) {
	const [engine, setEngine] = useState("all");
	const ids = [...new Set(answers.map((a) => a.engine))];
	const shown = engine === "all" ? answers : answers.filter((a) => a.engine === engine);
	return (
		<div className="oa-page">
			<header className="oa-head">
				<div>
					<p className="oa-eyebrow">Answers</p>
					<h1 className="oa-title">What each engine said</h1>
				</div>
				{ids.length > 1 ? (
					<div className="oa-actions">
						<label className="oa-label" htmlFor="oa-engine-filter">
							Engine
						</label>
						<select id="oa-engine-filter" className="oa-select" value={engine} onChange={(e) => setEngine(e.target.value)}>
							<option value="all">All engines</option>
							{ids.map((id) => (
								<option key={id} value={id}>
									{engineLabel(engines, id)}
								</option>
							))}
						</select>
					</div>
				) : null}
			</header>
			{answers.length === 0 ? (
				<section className="oa-empty">
					<h2>No answers yet</h2>
					<p>Answers appear here after your first run, with every brand mention highlighted and every cited link listed.</p>
				</section>
			) : (
				shown.map((answer) => (
					<article key={answer.id} className="oa-answer" data-error={answer.errorCode !== null}>
						<header className="oa-answer-head">
							<span className="oa-tag">{engineLabel(engines, answer.engine)}</span>
							<h2 className="oa-answer-prompt">{answer.promptText}</h2>
							{answer.errorCode === null ? (
								<span className="oa-answer-verdict" data-good={answer.brandRank !== null}>
									{answer.brandRank === null ? `${project.name} not mentioned` : `Mentioned ${ordinal(answer.brandRank)}`}
									{answer.brandCited ? " · your site cited" : ""}
								</span>
							) : null}
						</header>
						{answer.errorCode !== null ? (
							<p className="oa-alert">{answer.errorMessage ?? "This engine could not answer."}</p>
						) : (
							<>
								<AnswerText text={answer.text} brand={[project.name, ...project.aliases]} others={competitors} />
								{answer.citations.length > 0 ? (
									<ol className="oa-cites">
										{answer.citations.map((c) => (
											<li key={c.url}>
												{isHttp(c.url) ? (
													<a href={c.url} target="_blank" rel="noreferrer noopener">
														{c.title ?? c.domain}
													</a>
												) : (
													<span>{c.title ?? c.domain}</span>
												)}
												<span className="oa-muted"> {c.domain}</span>
											</li>
										))}
									</ol>
								) : (
									<p className="oa-muted">{answer.searched ? "No links in this answer." : "Answered without searching the web."}</p>
								)}
							</>
						)}
					</article>
				))
			)}
		</div>
	);
}
