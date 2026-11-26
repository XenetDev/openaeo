import type { AnswerView, EngineView, ProjectView, PromptView, ReportView } from "@api";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toAnswerMarkup } from "./answer-markup";
import { enginesIn, groupByQuestion, type Inline, markupBlocks, reportFileName } from "./report-pdf";
import { engineLabel, ordinal, percent } from "./shared";

type Props = {
	project: ProjectView;
	report: ReportView;
	answers: AnswerView[];
	prompts: PromptView[];
	engines: EngineView[];
	tag: string;
	onDone: () => void;
};

const TOP = 10;

const dateTime = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
const position = (rank: number | null) => (rank === null ? "–" : rank.toFixed(1));
const tone = (value: string | null) => (value ? value[0]?.toUpperCase() + value.slice(1) : "–");

function standing(answer: AnswerView | undefined): string {
	if (!answer) return "–";
	if (answer.errorCode !== null) return "Failed";
	return answer.brandRank === null ? "Not named" : ordinal(answer.brandRank);
}

/** Opens the print dialog on a report of the latest run, so it can be saved as a PDF. */
export function PrintReport({ project, report, answers, prompts, engines, tag, onDone }: Props) {
	const done = useRef(onDone);
	done.current = onDone;
	// biome-ignore lint/correctness/useExhaustiveDependencies: prints once, when the report first appears
	useEffect(() => {
		const root = document.documentElement;
		const title = document.title;
		let cancelled = false;
		let frame = 0;
		const restore = () => {
			root.classList.remove("oa-printing");
			document.title = title;
			window.removeEventListener("afterprint", finish);
		};
		const finish = () => {
			restore();
			done.current();
		};
		root.classList.add("oa-printing");
		document.title = reportFileName(project.name, report.run?.startedAt ?? null, tag);
		window.addEventListener("afterprint", finish);
		void document.fonts.ready.then(() => {
			if (!cancelled) frame = requestAnimationFrame(() => window.print());
		});
		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
			restore();
		};
	}, []);

	const brand = [project.name, ...project.aliases];
	const label = (id: string) => engineLabel(engines, id);
	const order = enginesIn(answers);
	const groups = groupByQuestion(answers, order, new Map(prompts.map((p) => [p.id, p.tags])));
	const { metrics, visibility, sentiment } = report.overall;
	const stats: [string, string][] = [
		["Visibility score", visibility.toFixed(1)],
		["Mentioned in", percent(metrics.mentionRate)],
		["Your site cited in", percent(metrics.citationRate)],
		["Average position", position(metrics.averageRank)],
		["Share of voice", percent(metrics.shareOfVoice)],
		["Sentiment", sentiment.score === null ? "–" : `${Math.round(sentiment.score)}`],
	];
	const competitors = report.competitors.slice(0, TOP);
	const domains = report.topDomains.slice(0, TOP);

	return createPortal(
		<article className="oa-print" aria-hidden="true">
			<header className="oa-print-head">
				<p className="oa-print-kicker">AI visibility report</p>
				<h1>{project.name}</h1>
				<p className="oa-print-meta">
					{report.run ? `Run on ${dateTime(report.run.startedAt)}` : "No run yet"}
					{project.domains.length ? ` · ${project.domains.join(", ")}` : ""}
					{` · ${groups.length} ${groups.length === 1 ? "question" : "questions"}`}
					{` · ${order.length} ${order.length === 1 ? "engine" : "engines"}`}
					{tag ? ` · Tag: ${tag}` : ""}
				</p>
			</header>

			<section className="oa-print-section">
				<h2>Summary</h2>
				<dl className="oa-print-stats">
					{stats.map(([name, value]) => (
						<div key={name}>
							<dt>{name}</dt>
							<dd>{value}</dd>
						</div>
					))}
				</dl>
				<p className="oa-print-note">
					Based on {metrics.answers} {metrics.answers === 1 ? "answer" : "answers"}. Visibility combines how often{" "}
					{project.name} is named, its position, its share of all brand mentions and how often its own site is cited, on
					a scale of 0 to 100.
				</p>
			</section>

			{report.engines.length ? (
				<section className="oa-print-section">
					<h2>By engine</h2>
					<table className="oa-print-table">
						<thead>
							<tr>
								<th>Engine</th>
								<th>Visibility</th>
								<th>Mentioned in</th>
								<th>Avg. position</th>
								<th>Site cited in</th>
								<th>Sentiment</th>
								<th>Failed</th>
							</tr>
						</thead>
						<tbody>
							{report.engines.map((e) => (
								<tr key={e.engine}>
									<td>{label(e.engine)}</td>
									<td>{e.visibility.toFixed(1)}</td>
									<td>{percent(e.metrics.mentionRate)}</td>
									<td>{position(e.metrics.averageRank)}</td>
									<td>{percent(e.metrics.citationRate)}</td>
									<td>{e.sentiment.score === null ? "–" : Math.round(e.sentiment.score)}</td>
									<td>{e.errors}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			) : null}

			{groups.length ? (
				<section className="oa-print-section">
					<h2>Questions</h2>
					<p className="oa-print-note">Where {project.name} was named in each answer.</p>
					<table className="oa-print-table oa-print-grid">
						<thead>
							<tr>
								<th>Question</th>
								{order.map((id) => (
									<th key={id}>{label(id)}</th>
								))}
								<th>Named</th>
							</tr>
						</thead>
						<tbody>
							{groups.map((group) => (
								<tr key={group.question}>
									<td>{group.question}</td>
									{order.map((id) => {
										const text = standing(group.answers.find((a) => a.engine === id));
										return (
											<td key={id} data-named={/^\d/.test(text) || undefined}>
												{text}
											</td>
										);
									})}
									<td>{group.answered ? `${group.named}/${group.answered}` : "Failed"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			) : null}

			{competitors.length || domains.length ? (
				<section className="oa-print-section oa-print-pair">
					{competitors.length ? (
						<div>
							<h2>Brands named</h2>
							<table className="oa-print-table">
								<thead>
									<tr>
										<th>Brand</th>
										<th>Mentioned in</th>
										<th>Avg. position</th>
									</tr>
								</thead>
								<tbody>
									{competitors.map((c) => (
										<tr key={c.name} data-brand={c.isBrand || undefined}>
											<td>
												{c.name}
												{c.isBrand ? " (you)" : ""}
											</td>
											<td>{percent(c.mentionRate)}</td>
											<td>{position(c.averageRank)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : null}
					{domains.length ? (
						<div>
							<h2>Sites the engines cited</h2>
							<table className="oa-print-table">
								<thead>
									<tr>
										<th>Site</th>
										<th>Citations</th>
									</tr>
								</thead>
								<tbody>
									{domains.map((d) => (
										<tr key={d.domain} data-brand={d.isBrand || undefined}>
											<td>
												{d.domain}
												{d.isBrand ? " (yours)" : ""}
											</td>
											<td>{d.citations}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : null}
				</section>
			) : null}

			{groups.length ? (
				<section className="oa-print-answers">
					<h2>Answers</h2>
					{groups.map((group, index) => (
						<section key={group.question} className="oa-print-question">
							<h3>
								{index + 1}. {group.question}
							</h3>
							{group.tags.length ? <p className="oa-print-note">Tags: {group.tags.join(", ")}</p> : null}
							{group.answers.map((answer) => (
								<PrintAnswer key={answer.id} answer={answer} label={label(answer.engine)} brand={brand} />
							))}
						</section>
					))}
				</section>
			) : null}

			<footer className="oa-print-foot">Made with OpenAEO · openaeo.io</footer>
		</article>,
		document.body,
	);
}

function Inlines({ parts }: { parts: Inline[] }) {
	return parts.map((part, i) =>
		// biome-ignore lint/suspicious/noArrayIndexKey: parts never reorder
		part.bold ? <strong key={i}>{part.text}</strong> : <span key={i}>{part.text}</span>,
	);
}

function PrintAnswer({ answer, label, brand }: { answer: AnswerView; label: string; brand: string[] }) {
	if (answer.errorCode !== null)
		return (
			<div className="oa-print-answer">
				<h4>{label}</h4>
				<p className="oa-print-note">Could not answer: {answer.errorMessage ?? "no reason was given."}</p>
			</div>
		);
	const markup = toAnswerMarkup(answer.text, answer.citations, brand);
	const facts = [
		answer.brandRank === null ? "Not named" : `Named ${ordinal(answer.brandRank)} of ${answer.mentions.length}`,
		answer.brandCited ? "Your site cited" : "Your site not cited",
		`Tone: ${tone(answer.sentiment)}`,
		answer.searched ? `${answer.citations.length} sources` : "From memory",
	];
	return (
		<div className="oa-print-answer">
			<h4>
				{label}
				{answer.model ? <span> · {answer.model}</span> : null}
			</h4>
			<p className="oa-print-facts">{facts.join(" · ")}</p>
			<div className="oa-print-body">
				{markupBlocks(markup.answer).map((block, i) =>
					block.kind === "list" ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: blocks never reorder
						<ul key={i}>
							{block.items.map((item, j) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: items never reorder
								<li key={j}>
									<Inlines parts={item} />
								</li>
							))}
						</ul>
					) : (
						// biome-ignore lint/suspicious/noArrayIndexKey: blocks never reorder
						<p key={i}>
							<Inlines parts={block.parts} />
						</p>
					),
				)}
			</div>
			{markup.sources.length ? (
				<ol className="oa-print-sources">
					{markup.sources.map((source) => (
						<li key={source.href}>
							{source.title}
							{source.title !== source.name ? <span> · {source.name}</span> : null}
							<span className="oa-print-url">{source.href}</span>
						</li>
					))}
				</ol>
			) : null}
		</div>
	);
}
