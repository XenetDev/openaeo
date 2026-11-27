import type { CompetitorInsightView, EngineView } from "@api";
import { BubbleChatIcon, News01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { api } from "@/api";
import { EmptyState } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { Select } from "@/components/ui/select-clean";
import { Skeleton } from "@/components/ui/skeleton-clean";
import { EngineLogo, engineLabel, ShareList } from "./shared";

type Props = {
	projectId: string;
	brand: string;
	/** Tracked competitors, the one named most first */
	names: string[];
	engines: EngineView[];
	/** Changes when a new run finishes, so the picture is fetched again */
	runId: string | null;
};

const host = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

/** Why one competitor gets named: the questions, what the engines said, and the sites and pages behind it. */
export function CompetitorInsight({ projectId, brand, names, engines, runId }: Props) {
	const [picked, setPicked] = useState(names[0] ?? "");
	const name = names.includes(picked) ? picked : (names[0] ?? "");
	const [insight, setInsight] = useState<CompetitorInsightView | null>(null);
	const [failed, setFailed] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetched again when a new run finishes
	useEffect(() => {
		if (!name) return;
		let live = true;
		setInsight(null);
		setFailed(false);
		api.competitorInsight(projectId, name).then(
			(result) => live && setInsight(result),
			() => live && setFailed(true),
		);
		return () => {
			live = false;
		};
	}, [projectId, name, runId]);

	if (!name || !runId) return null;

	const position =
		insight?.averageRank === null || !insight ? "" : ` · average position ${insight.averageRank.toFixed(1)}`;
	const top = Math.max(1, insight?.sites[0]?.citations ?? 1);

	return (
		<>
			<Card>
				<CardHeader
					title={`Why ${name} gets named`}
					description={
						failed
							? "This did not load. Pick the competitor again to retry."
							: insight
								? insight.named === 0
									? `Not named in any of the ${insight.answers} answers of the latest run.`
									: `Named in ${insight.named} of ${insight.answers} answers in the latest run${position}.`
								: "Reading the latest answers."
					}
					action={
						names.length > 1 ? (
							<Select
								aria-label="Competitor"
								size="sm"
								value={name}
								options={names.map((option) => ({ value: option, label: option }))}
								onChange={setPicked}
							/>
						) : undefined
					}
				/>
			</Card>

			{!insight && !failed ? (
				<div className="oa-cols-2" role="status" aria-label={`Loading ${name}`}>
					<Skeleton height={180} width="100%" />
					<Skeleton height={180} width="100%" />
				</div>
			) : insight && insight.named > 0 ? (
				<>
					<div className="oa-cols-2">
						<Card className="oa-card-fill">
							<CardHeader title="Questions they are named for" description={`Where ${brand} is missing comes first.`} />
							<CardContent>
								<div className="oa-missed">
									{insight.questions.map((item) => (
										<div key={item.question}>
											<span className="oa-grow">
												<b>{item.question}</b>
												<span className="oa-inline">
													{item.engines.map((id) => (
														<EngineLogo key={id} engine={id} label={engineLabel(engines, id)} size={14} />
													))}
												</span>
											</span>
											<Badge tone={item.brandNamed ? "success" : "warning"}>
												{item.brandNamed ? "You are named too" : "You are missing"}
											</Badge>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
						<Card className="oa-card-fill">
							<CardHeader title="What AI says about them" description="Taken from the latest answers." />
							<CardContent>
								{insight.quotes.length ? (
									<div className="oa-missed">
										{insight.quotes.map((quote) => (
											<div key={`${quote.engine}:${quote.question}`}>
												<span className="oa-grow">
													<b className="oa-quote">{quote.text}</b>
													<span className="oa-inline oa-quiet">
														<EngineLogo engine={quote.engine} label={engineLabel(engines, quote.engine)} size={14} />
														{engineLabel(engines, quote.engine)} · {quote.question}
													</span>
												</span>
											</div>
										))}
									</div>
								) : (
									<EmptyState
										bare
										icon={BubbleChatIcon}
										title="Nothing to quote"
										text="The engines named them without saying why."
									/>
								)}
							</CardContent>
						</Card>
					</div>
					<div className="oa-cols-2">
						<Card className="oa-card-fill">
							<CardHeader
								title="Sites behind their mentions"
								description="Cited in the answers that name them. Getting mentioned there helps you too."
							/>
							<CardContent>
								<ShareList
									items={insight.sites.map((site) => ({
										label: site.domain,
										value: `${site.citations}`,
										share: (site.citations / top) * 100,
										badge: site.namesBrand ? undefined : <Badge tone="warning">Never with you</Badge>,
									}))}
									empty={
										<EmptyState
											bare
											icon={News01Icon}
											title="No other sites cited"
											text="The answers that name them linked to no third-party site."
										/>
									}
								/>
							</CardContent>
						</Card>
						<Card className="oa-card-fill">
							<CardHeader
								title="Their pages AI cites"
								description="The content that earns them a link. This is what to match."
							/>
							<CardContent>
								{insight.pages.length ? (
									<div className="oa-missed">
										{insight.pages.map((page) => (
											<div key={page.url}>
												<span className="oa-grow">
													<b>
														<a href={page.url} target="_blank" rel="noreferrer">
															{page.title || host(page.url)}
														</a>
													</b>
													{page.title ? <span className="oa-quiet">{host(page.url)}</span> : null}
												</span>
												<Badge>{`Cited ${page.citations}×`}</Badge>
											</div>
										))}
									</div>
								) : (
									<EmptyState
										bare
										icon={News01Icon}
										title="None of their own pages cited"
										text="They are named from other sites, not from their own. Their website is not on file, or the engines did not link to it."
									/>
								)}
							</CardContent>
						</Card>
					</div>
				</>
			) : null}
		</>
	);
}
