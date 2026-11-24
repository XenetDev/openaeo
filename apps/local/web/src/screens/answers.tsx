import type { AnswerView, EngineView, PageId, ProjectView, PromptView } from "@api";
import {
	ArrowRight02Icon,
	BubbleChatIcon,
	Download01Icon,
	PlayIcon,
	UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, Icon } from "@/components/app-shell";
import { AIAnswer } from "@/components/ui/ai-answer-clean";
import { Badge, type BadgeTone } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { SegmentedControl } from "@/components/ui/segmented-control-clean";
import { Spinner } from "@/components/ui/spinner-clean";
import { toast } from "@/components/ui/toaster-clean";
import { toAnswerMarkup } from "./answer-markup";
import { EngineLogo, engineLabel, Facts, ordinal, Page, ShareList } from "./shared";

type Props = {
	answers: AnswerView[];
	prompts: PromptView[];
	project: ProjectView;
	engines: EngineView[];
	live: boolean;
	filter: string;
	onFilter: (text: string) => void;
	onRunAgain: () => void;
	onNavigate: (page: PageId) => void;
	onExport: () => void;
	tag: string;
	tagControl: ReactNode;
};

const NEXT: { label: string; page: PageId }[] = [
	{ label: "See which sites the engines rely on", page: "sources" },
	{ label: "Compare how often competitors are named", page: "competitors" },
	{ label: "Check whether AI engines can read your site", page: "audit" },
];

const seconds = (ms: number) => Math.max(0.1, Math.round(ms / 100) / 10);

function standing(answer: AnswerView | undefined): { text: string; tone: BadgeTone } {
	if (!answer) return { text: "Waiting", tone: "neutral" };
	if (answer.errorCode !== null) return { text: "Failed", tone: "danger" };
	if (answer.brandRank === null) return { text: "Not named", tone: "warning" };
	return { text: ordinal(answer.brandRank), tone: "success" };
}

function Favicon({ href }: { href: string }) {
	try {
		return <img src={`${new URL(href).origin}/favicon.ico`} alt="" loading="lazy" referrerPolicy="no-referrer" />;
	} catch {
		return null;
	}
}

function facts(answer: AnswerView, brand: string): [string, string][] {
	return [
		[
			"Position",
			answer.brandRank === null
				? `${brand} is not named`
				: `${ordinal(answer.brandRank)} of ${answer.mentions.length} ${answer.mentions.length === 1 ? "brand" : "brands"}`,
		],
		["Your site", answer.brandCited ? "Linked as a source" : "Not linked"],
		[
			"Based on",
			answer.searched
				? `A web search, ${answer.citations.length} ${answer.citations.length === 1 ? "source" : "sources"}`
				: "The engine's memory",
		],
		...(answer.sentiment
			? ([["Tone about you", answer.sentiment[0]?.toUpperCase() + answer.sentiment.slice(1)]] as [string, string][])
			: []),
	];
}

function Answer({
	answer,
	question,
	brand,
	animate,
	onSeen,
	onNavigate,
}: {
	answer: AnswerView;
	question: string;
	brand: string[];
	animate: boolean;
	onSeen: () => void;
	onNavigate: (page: PageId) => void;
}) {
	const [streamed] = useState(animate);
	// biome-ignore lint/correctness/useExhaustiveDependencies: marks the answer as seen once, when it first appears
	useEffect(() => {
		onSeen();
	}, []);
	const markup = useMemo(() => toAnswerMarkup(answer.text, answer.citations, brand), [answer, brand]);
	return (
		<AIAnswer
			framed
			className="oa-answer-card"
			question={question}
			sources={markup.sources.map((s) => ({ ...s, icon: <Favicon href={s.href} /> }))}
			answer={markup.answer}
			animate={streamed}
			tookSeconds={seconds(answer.durationMs)}
			followUps={NEXT.map((n) => n.label)}
			onFollowUp={(label) => onNavigate(NEXT.find((n) => n.label === label)?.page ?? "sources")}
			onCopy={() => toast.success("Answer copied")}
		/>
	);
}

export function AnswersScreen({
	answers: every,
	prompts,
	project,
	engines,
	live,
	filter,
	onFilter,
	onRunAgain,
	onNavigate,
	onExport,
	tag,
	tagControl,
}: Props) {
	const tagsOf = new Map(prompts.map((p) => [p.id, p.tags]));
	const answers = tag === "" ? every : every.filter((a) => tagsOf.get(a.promptId)?.includes(tag));
	const brand = useMemo(() => [project.name, ...project.aliases], [project]);
	const seen = useRef<Set<string> | null>(null);
	if (seen.current === null) seen.current = new Set(answers.map((a) => a.id));
	const known = seen.current;

	const keyOf = (a: AnswerView) => a.promptId ?? a.promptText;
	const labels = new Map(answers.map((a) => [keyOf(a), a.promptText]));
	const questions = [...labels.keys()];
	const ids = [...new Set(answers.map((a) => a.engine))];
	const wanted = answers.find((a) => a.promptText === filter);
	const key = wanted ? keyOf(wanted) : (questions[0] ?? "");
	const question = labels.get(key) ?? "";
	const group = answers.filter((a) => keyOf(a) === key);
	const [picked, setPicked] = useState("");
	const engine = ids.includes(picked) ? picked : (group[0]?.engine ?? ids[0] ?? "");
	const answer = group.find((a) => a.engine === engine);
	const label = engineLabel(engines, engine);
	const top = Math.max(1, ...(answer?.mentions.map((m) => m.count) ?? []));

	return (
		<Page
			brand={project.name}
			title="Answers"
			actions={
				<>
					{live ? (
						<Badge tone="info" live>
							Collecting answers
						</Badge>
					) : null}
					{tagControl}
					{every.length > 0 ? (
						<Button variant="secondary" size="sm" onClick={onExport} icon={<Icon icon={Download01Icon} size={14} />}>
							Export CSV
						</Button>
					) : null}
				</>
			}
		>
			{every.length === 0 ? (
				<EmptyState
					icon={BubbleChatIcon}
					title={live ? "Waiting for the first answer" : "No answers yet"}
					text="After a run, every question shows here with what each AI engine answered, who it named and the sites it relied on."
					action={
						live ? undefined : (
							<Button
								variant="secondary"
								size="sm"
								onClick={() => onNavigate("prompts")}
								iconRight={<Icon icon={ArrowRight02Icon} size={14} />}
							>
								Go to Prompts
							</Button>
						)
					}
				/>
			) : (
				<div className="oa-answers">
					<Card className="oa-qlist">
						<CardHeader title="Questions" description={`${questions.length} in the latest run`} />
						<nav aria-label="Questions">
							{questions.map((id) => {
								const text = labels.get(id) ?? "";
								const good = answers.filter((a) => keyOf(a) === id && a.errorCode === null);
								const named = good.filter((a) => a.brandRank !== null).length;
								return (
									<button
										key={id}
										type="button"
										className="oa-q"
										aria-current={id === key || undefined}
										onClick={() => onFilter(text)}
									>
										<span>{text}</span>
										<Badge
											tone={
												good.length === 0
													? "danger"
													: named === good.length
														? "success"
														: named === 0
															? "warning"
															: "neutral"
											}
										>
											{good.length === 0 ? "Failed" : `${named}/${good.length}`}
										</Badge>
									</button>
								);
							})}
						</nav>
					</Card>

					<div className="oa-answer-main">
						<SegmentedControl
							kind="tabs"
							aria-label="Engine"
							value={engine}
							onChange={setPicked}
							options={ids.map((id) => {
								const state = standing(group.find((a) => a.engine === id));
								return {
									value: id,
									label: engineLabel(engines, id),
									icon: <EngineLogo engine={id} label={engineLabel(engines, id)} />,
									badge: (
										<span className="oa-tab-badge">
											<Badge tone={state.tone}>{state.text}</Badge>
										</span>
									),
								};
							})}
						/>
						{!answer ? (
							live ? (
								<Card>
									<CardHeader
										icon={<Spinner />}
										title={`Waiting for ${label}`}
										description="The answer appears here as soon as it arrives."
									/>
								</Card>
							) : (
								<EmptyState
									icon={BubbleChatIcon}
									title={`No answer from ${label}`}
									text="This engine was not asked this question in the latest run."
								/>
							)
						) : answer.errorCode !== null ? (
							<Card>
								<CardHeader
									title={`${label} could not answer`}
									description={answer.errorMessage ?? "No reason was given."}
								/>
								<CardContent>
									<Button variant="secondary" size="sm" onClick={onRunAgain} icon={<Icon icon={PlayIcon} size={14} />}>
										Run again
									</Button>
								</CardContent>
							</Card>
						) : (
							<Answer
								key={answer.id}
								answer={answer}
								question={question}
								brand={brand}
								animate={!known.has(answer.id)}
								onSeen={() => known.add(answer.id)}
								onNavigate={onNavigate}
							/>
						)}
					</div>

					{answer && answer.errorCode === null ? (
						<aside className="oa-answer-rail">
							<Card>
								<CardHeader title={`How ${label} treated ${project.name}`} />
								<CardContent>
									<Facts rows={facts(answer, project.name)} />
								</CardContent>
							</Card>
							<Card>
								<CardHeader title="Brands named, in order" description="The order they first appear in this answer." />
								<CardContent>
									<ShareList
										empty={
											<EmptyState
												bare
												icon={UserMultipleIcon}
												title="No tracked brand named"
												text="This answer names neither you nor a competitor you track."
											/>
										}
										items={[...answer.mentions]
											.sort((a, b) => a.rank - b.rank)
											.map((m) => ({
												label: `${m.rank}. ${m.entity}`,
												value: `${m.count}×`,
												share: (m.count / top) * 100,
												badge: brand.some((n) => n.toLowerCase() === m.entity.toLowerCase()) ? (
													<Badge tone="success">You</Badge>
												) : undefined,
											}))}
									/>
								</CardContent>
							</Card>
						</aside>
					) : null}
				</div>
			)}
		</Page>
	);
}
