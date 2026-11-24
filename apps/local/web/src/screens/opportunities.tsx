import type { EngineView, OpportunitiesView, PageId, ProjectView } from "@api";
import { ArrowRight02Icon, Target02Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { EmptyState, Icon } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar-clean";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { DataTable } from "@/components/ui/data-table-clean";
import { StatCard } from "@/components/ui/stat-card-clean";
import { HighMark, LowMark, MediumMark } from "./command-icons";
import { EngineLogo, engineLabel, Page } from "./shared";

type Props = {
	project: ProjectView;
	engines: EngineView[];
	found: OpportunitiesView;
	onOpenQuestion: (text: string) => void;
	onNavigate: (page: PageId) => void;
};

const MARKS: Record<string, ReactNode> = { high: <HighMark />, medium: <MediumMark />, low: <LowMark /> };

export function OpportunitiesScreen({ project, engines, found, onOpenQuestion, onNavigate }: Props) {
	const nothing = found.missed.length === 0 && found.sites.length === 0 && found.fixes.length === 0;
	return (
		<Page brand={project.name} title="Opportunities">
			{nothing ? (
				<EmptyState
					icon={Target02Icon}
					title={found.runId ? "Nothing to chase right now" : "No runs yet"}
					text={
						found.runId
							? "You are named wherever your competitors are, and no outside site is being cited. Add more questions to look wider."
							: "After a run, this page lists the questions you are missing from, the sites worth getting mentioned on and the website fixes that matter most."
					}
					action={
						<Button
							variant="secondary"
							size="sm"
							onClick={() => onNavigate("prompts")}
							iconRight={<Icon icon={ArrowRight02Icon} size={14} />}
						>
							Go to Prompts
						</Button>
					}
				/>
			) : (
				<>
					<div className="oa-cols-3">
						<StatCard
							label="Questions you are missing from"
							value={found.missed.length}
							footer="A competitor is named and you are not"
						/>
						<StatCard
							label="Sites worth being on"
							value={found.sites.length}
							footer="Cited by the engines, owned by neither you nor a competitor"
						/>
						<StatCard
							label="Website fixes"
							value={found.fixes.length}
							footer={found.fixes.length ? "From your latest audit" : "Run an audit to find them"}
						/>
					</div>

					{found.missed.length > 0 ? (
						<Card>
							<CardHeader
								title="Questions you are missing from"
								description="Each of these was answered with a competitor's name and without yours. Read the answer to see what earned them the mention."
							/>
							<CardContent>
								<div className="oa-missed">
									{found.missed.map((miss) => (
										<div key={miss.question}>
											<span className="oa-grow">
												<b>{miss.question}</b>
												<span className="oa-inline">
													{miss.engines.map((id) => (
														<span key={id} className="oa-inline" style={{ gap: 5 }}>
															<EngineLogo engine={id} label={engineLabel(engines, id)} size={14} />
															{engineLabel(engines, id)}
														</span>
													))}
													{miss.named.slice(0, 6).map((name) => (
														<Badge key={name}>{name}</Badge>
													))}
													{miss.named.length > 6 ? <Badge>+{miss.named.length - 6}</Badge> : null}
												</span>
											</span>
											<Button
												variant="secondary"
												size="sm"
												onClick={() => onOpenQuestion(miss.question)}
												iconRight={<Icon icon={ArrowRight02Icon} size={14} />}
											>
												Read the answers
											</Button>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					) : null}

					{found.sites.length > 0 ? (
						<DataTable
							title="Sites worth being mentioned on"
							editable={false}
							columns={[
								{ key: "site", label: "Site", type: "title" },
								{ key: "citations", label: "Times cited", type: "number", width: "130px" },
								{ key: "questions", label: "Questions", type: "number", width: "120px" },
								{ key: "link", label: "Open", type: "link" },
							]}
							rows={found.sites.map((s) => ({
								id: s.domain,
								logo: <Avatar name={s.domain} size={20} shape="square" />,
								site: s.domain,
								citations: s.citations,
								questions: s.questions,
								link: `https://${s.domain}`,
							}))}
						/>
					) : null}

					{found.fixes.length > 0 ? (
						<Card>
							<CardHeader
								title="Website fixes that matter most"
								description="From your latest audit, most serious first."
								action={
									<Button
										variant="secondary"
										size="sm"
										onClick={() => onNavigate("audit")}
										iconRight={<Icon icon={ArrowRight02Icon} size={14} />}
									>
										Open the audit
									</Button>
								}
							/>
							<CardContent>
								<div className="oa-missed">
									{found.fixes.slice(0, 6).map((fix) => (
										<div key={fix.title}>
											{MARKS[fix.severity] ?? <LowMark />}
											<span className="oa-grow">
												<b>{fix.title}</b>
											</span>
											<Badge>
												{fix.pages} {fix.pages === 1 ? "page" : "pages"}
											</Badge>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					) : null}
				</>
			)}
		</Page>
	);
}
