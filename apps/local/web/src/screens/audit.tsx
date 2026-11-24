import type { ArtefactsView, AuditView, FindingView, ProjectView } from "@openaeo/ui";
import { CheckListIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { EmptyState } from "@/components/app-shell";
import { AgentFindings, type Finding, type FindingAgent } from "@/components/ui/agent-findings-clean";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { CodeBlock } from "@/components/ui/code-block-clean";
import { StatCard } from "@/components/ui/stat-card-clean";
import { TextField } from "@/components/ui/text-field-clean";
import { Page, when } from "./shared";

type Props = {
	project: ProjectView;
	audit: AuditView | null;
	findings: FindingView[];
	artefacts: ArtefactsView;
	defaultUrl: string;
	onRun: (url: string) => void;
	onCancel: () => void;
	onCopyBrief: () => void;
};

const AREAS: { id: string; name: string; checks: string[] }[] = [
	{ id: "access", name: "Crawler access", checks: ["crawler-blocked", "crawler-partly-blocked", "robots-error", "robots-missing", "llms-txt-missing", "site-unreachable"] },
	{ id: "content", name: "Readable content", checks: ["js-only-content", "no-h1", "missing-title-or-description"] },
	{ id: "data", name: "Structured data", checks: ["no-structured-data", "invalid-structured-data", "no-organization-schema", "faq-without-schema"] },
	{ id: "answers", name: "Answers and trust", checks: ["no-direct-answer", "no-question-headings", "no-author", "no-date", "stale-content", "no-outbound-citations"] },
];
const SEVERITY = { high: "critical", medium: "warning", low: "note" } as const;
const LEVELS = [
	{ id: "high", label: "High", tone: "danger", note: "These stop AI engines from reading or using the site." },
	{ id: "medium", label: "Medium", tone: "warning", note: "These make pages harder for engines to quote and trust." },
	{ id: "low", label: "Low", tone: "neutral", note: "Smaller improvements." },
] as const;
const FILES: { key: keyof ArtefactsView; name: string; language: string }[] = [
	{ key: "robotsTxt", name: "robots.txt", language: "txt" },
	{ key: "llmsTxt", name: "llms.txt", language: "md" },
	{ key: "organizationJsonLd", name: "organization.jsonld", language: "json" },
];

const pathOf = (url: string) => {
	try {
		return new URL(url).pathname || "/";
	} catch {
		return url;
	}
};

export function AuditScreen({ project, audit, findings, artefacts, defaultUrl, onRun, onCancel, onCopyBrief }: Props) {
	const [url, setUrl] = useState(defaultUrl);
	const running = audit?.status === "running";
	const unread = audit?.pages.filter((p) => p.error) ?? [];
	const read = (audit?.pages.length ?? 0) - unread.length;
	const at = audit?.finishedAt ?? audit?.startedAt ?? 0;
	const done = audit?.status === "done";

	const agents: FindingAgent[] = AREAS.map((area) => {
		const count = findings.filter((f) => area.checks.includes(f.checkId)).length;
		return { id: area.id, name: area.name, step: count === 0 ? "No problems" : `${count} ${count === 1 ? "finding" : "findings"}`, done: area.checks.length, total: area.checks.length };
	});
	const seen = new Set<string>();
	const feed: Finding[] = findings
		.filter((f) => (seen.has(f.title) ? false : (seen.add(f.title), true)))
		.map((f, i) => ({
			id: `${f.checkId}-${i}`,
			agentId: AREAS.find((a) => a.checks.includes(f.checkId))?.id ?? "answers",
			title: f.title,
			severity: SEVERITY[f.severity],
			location: pathOf(f.url),
			at: at - (findings.length - i) * 1000,
		}));

	return (
		<Page
			brand={project.name}
			title="Audit"
		>
			<Card>
				<CardHeader title="Can AI engines read and quote your site?" description="Reads up to 25 pages in a few seconds and uses no AI calls." action={running ? <Badge tone="info" live>Reading the site</Badge> : undefined} />
				<CardContent>
					<form
						className="oa-inline-end"
						onSubmit={(e) => {
							e.preventDefault();
							if (!running) onRun(url.trim());
						}}
					>
						<div className="oa-grow" style={{ maxWidth: 420 }}>
							<TextField label="Website to check" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com" disabled={running} />
						</div>
						{running ? (
							<Button type="button" variant="secondary" onClick={onCancel}>
								Stop
							</Button>
						) : (
							<Button type="submit" disabled={url.trim() === ""}>
								Run audit
							</Button>
						)}
					</form>
				</CardContent>
			</Card>

			{!audit ? (
				<EmptyState icon={CheckListIcon} title="No audit yet" text="An audit checks what AI engines need: access for their crawlers, content present without JavaScript, structured data and direct answers." />
			) : running ? (
				<div className="oa-cols-3">
					{["Audit score", "Pages read", "Findings"].map((label) => (
						<StatCard key={label} label={label} value="" change={0} loading />
					))}
				</div>
			) : audit.status === "interrupted" ? (
				<Card>
					<CardHeader title="The last audit stopped before it finished" description={`Run the audit of ${audit.origin} again.`} action={<Badge tone="warning">Interrupted</Badge>} />
				</Card>
			) : (
				<>
					{audit.own === false ? (
						<Card>
							<CardHeader
								title="This is not your project's website"
								description={`The audit of ${audit.origin} is shown for comparison and is not used for your fix brief.`}
								action={<Badge>Comparison</Badge>}
							/>
						</Card>
					) : null}
					<div className="oa-cols-3">
						<StatCard label="Audit score" value={audit.score ?? 0} format={(n) => `${Math.round(n)} / 100`} footer="A rough guide. It counts problems; it does not predict AI visibility." />
						<StatCard label="Pages read" value={read} footer={unread.length > 0 ? `${unread.length} could not be read` : "All readable"} />
						<StatCard label="Findings" value={findings.length} footer={`${findings.filter((f) => f.severity === "high").length} high · ${when(audit.startedAt)}`} />
					</div>

					{findings.length === 0 ? (
						<EmptyState icon={CheckListIcon} title="No problems found" text="Every check passed on the pages read." />
					) : (
						<>
							<div className="oa-cols-2">
								<AgentFindings title={`Checks on ${audit.origin.replace(/^https?:\/\//, "")}`} agents={agents} findings={feed} rows={Math.min(6, feed.length)} now={at} />
								<Card>
									<CardHeader title="Fix these with your AI agent" description="OpenAEO finds the problems. Your own Claude Code or Codex fixes them in your site's code, under your supervision." />
									<CardContent>
										<div className="oa-stack">
											<p className="oa-quiet">1. Connect your agent once (the command is in Settings).</p>
											<p className="oa-quiet">2. Open your website's code and ask: “get the OpenAEO fix brief and fix the findings”.</p>
											<p className="oa-quiet">3. Run the audit again to confirm the findings are gone.</p>
											{audit.own !== false ? (
												<span>
													<Button size="sm" onClick={onCopyBrief}>
														Copy fix brief
													</Button>
												</span>
											) : null}
										</div>
									</CardContent>
								</Card>
							</div>
							{LEVELS.map((level) => {
								const groups = new Map<string, FindingView[]>();
								for (const finding of findings.filter((f) => f.severity === level.id)) groups.set(finding.title, [...(groups.get(finding.title) ?? []), finding]);
								if (groups.size === 0) return null;
								return (
									<Card key={level.id}>
										<CardHeader title={`${level.label} priority`} description={level.note} action={<Badge tone={level.tone}>{groups.size} to fix</Badge>} />
										<CardContent>
											<div className="oa-finding-list">
												{[...groups.entries()].map(([title, group]) => (
													<article key={title}>
														<h3>
															{title} {group.length > 1 ? <Badge>{group.length} pages</Badge> : null}
														</h3>
														<p>{group[0]?.evidence}</p>
														<CodeBlock code={group[0]?.fix ?? ""} language="txt" filename="How to fix" wrap />
														<ul className="oa-urls">
															{group.slice(0, 6).map((f) => (
																<li key={f.url}>{f.url}</li>
															))}
															{group.length > 6 ? <li>and {group.length - 6} more</li> : null}
														</ul>
													</article>
												))}
											</div>
										</CardContent>
									</Card>
								);
							})}
						</>
					)}

					{FILES.some((f) => artefacts[f.key]) ? (
						<Card>
							<CardHeader title="Starter files" description="Drafts to adapt, not to paste blindly. Keep any rules your current robots.txt needs." />
							<CardContent>
								<div className="oa-stack">
									{FILES.map((file) => (artefacts[file.key] ? <CodeBlock key={file.key} code={artefacts[file.key] ?? ""} language={file.language} filename={file.name} maxHeight={220} /> : null))}
								</div>
							</CardContent>
						</Card>
					) : null}

					{unread.length > 0 || audit.skipped > 0 ? (
						<Card>
							<CardHeader title="Not checked" description={audit.skipped > 0 ? `${audit.skipped} more pages were not checked, because an audit reads 25 pages at most.` : undefined} />
							{unread.length > 0 ? (
								<CardContent>
									<ul className="oa-urls" style={{ marginTop: 0 }}>
										{unread.slice(0, 10).map((p) => (
											<li key={p.url}>
												{p.url} · {p.error}
											</li>
										))}
									</ul>
								</CardContent>
							) : null}
						</Card>
					) : null}
				</>
			)}
		</Page>
	);
}
