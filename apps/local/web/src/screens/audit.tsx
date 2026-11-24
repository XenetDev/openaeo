import type { ArtefactsView, AuditView, FindingView, ProjectView } from "@openaeo/ui";
import { CheckListIcon, Globe02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { EmptyState, Icon } from "@/components/app-shell";
import { AgentFindings, type Finding, type FindingAgent } from "@/components/ui/agent-findings-clean";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { CodeBlock } from "@/components/ui/code-block-clean";
import { StatCard } from "@/components/ui/stat-card-clean";
import { AgentMark, FilesMark, HighMark, LowMark, MediumMark, SkippedMark } from "./command-icons";
import { EngineLogo, Page, when } from "./shared";
import { SegmentedControl } from "@/components/ui/segmented-control-clean";

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
	{ id: "high", label: "High", tone: "danger", mark: <HighMark />, note: "These stop AI engines from reading or using the site." },
	{ id: "medium", label: "Medium", tone: "warning", mark: <MediumMark />, note: "These make pages harder for engines to quote and trust." },
	{ id: "low", label: "Low", tone: "info", mark: <LowMark />, note: "Smaller improvements." },
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

function FixCard({ count, own, onCopyBrief }: { count: number; own: boolean; onCopyBrief: () => void }) {
	const [way, setWay] = useState<"paste" | "connect">("paste");
	return (
		<Card className="oa-cta">
			<CardHeader
				icon={
					<span className="oa-cta-mark">
						<AgentMark />
					</span>
				}
				title={`Let your AI agent fix ${count === 1 ? "this finding" : `all ${count} findings`}`}
				description="OpenAEO writes the instructions. Your own Claude Code or Codex makes the changes in your website's code, and you review them."
				action={
					<span className="oa-cta-engines">
						<EngineLogo engine="claude-cli" label="Claude" size={18} />
						<EngineLogo engine="codex-cli" label="ChatGPT" size={18} />
					</span>
				}
			/>
			<CardContent>
				<div className="oa-stack">
					<SegmentedControl
						aria-label="How to hand over the fixes"
						size="sm"
						value={way}
						onChange={setWay}
						options={[
							{ value: "paste", label: "Copy and paste" },
							{ value: "connect", label: "Connect once" },
						]}
					/>
					{way === "paste" ? (
						<>
							<ol className="oa-steps">
								<li>Copy the fix brief. It lists every finding, the pages affected and how to fix each one.</li>
								<li>Open your website's code in Claude Code or Codex and paste it.</li>
								<li>Review the changes, publish them, then run the audit again.</li>
							</ol>
							{own ? (
								<span>
									<Button size="lg" onClick={onCopyBrief}>
										Copy fix brief
									</Button>
								</span>
							) : (
								<p className="oa-quiet">The brief is only offered for your own website.</p>
							)}
						</>
					) : (
						<>
							<ol className="oa-steps">
								<li>Run one of these once in a terminal. Your agent can then read your reports and findings by itself.</li>
							</ol>
							<CodeBlock language="sh" filename="Claude Code" code="claude mcp add openaeo --scope user -- openaeo mcp" />
							<CodeBlock language="sh" filename="Codex" code="codex mcp add openaeo -- openaeo mcp" />
							<ol className="oa-steps" start={2}>
								<li>In your website's code, tell your agent:</li>
							</ol>
							<CodeBlock language="txt" filename="Say this" code="Get the OpenAEO fix brief and fix the findings." wrap />
						</>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

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
			<section className="oa-audit-hero" data-tall={!audit || undefined}>
				<h2>Can AI read your website?</h2>
				<p>Reads up to 25 pages the way an AI crawler does and shows what stops engines quoting you.</p>
				<form
					className="oa-search"
					onSubmit={(e) => {
						e.preventDefault();
						if (!running) onRun(url.trim());
					}}
				>
					<Icon icon={Globe02Icon} size={18} />
					<input aria-label="Website to check" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourwebsite.com" disabled={running} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
					{running ? (
						<Button type="button" variant="secondary" onClick={onCancel}>
							Stop
						</Button>
					) : (
						<Button type="submit" disabled={url.trim() === ""}>
							{audit ? "Check again" : "Check my site"}
						</Button>
					)}
				</form>
				{running ? (
					<Badge tone="info" live>
						Reading the site
					</Badge>
				) : (
					<div className="oa-crawlers" aria-label="Crawlers checked">
						<span>Checks access for</span>
						{["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"].map((bot) => (
							<Badge key={bot}>{bot}</Badge>
						))}
						<span>and 7 more</span>
					</div>
				)}
			</section>

			{!audit ? null : running ? (
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
								<FixCard count={findings.length} own={audit.own !== false} onCopyBrief={onCopyBrief} />
							</div>
							{LEVELS.map((level) => {
								const groups = new Map<string, FindingView[]>();
								for (const finding of findings.filter((f) => f.severity === level.id)) groups.set(finding.title, [...(groups.get(finding.title) ?? []), finding]);
								if (groups.size === 0) return null;
								return (
									<Card key={level.id}>
										<CardHeader icon={level.mark} title={`${level.label} priority`} description={level.note} action={<Badge tone={level.tone}>{groups.size} to fix</Badge>} />
										<CardContent>
											<div className="oa-finding-list" data-tone={level.id}>
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
							<CardHeader icon={<FilesMark />} title="Starter files" description="Drafts to adapt, not to paste blindly. Keep any rules your current robots.txt needs." />
							<CardContent>
								<div className="oa-stack">
									{FILES.map((file) => (artefacts[file.key] ? <CodeBlock key={file.key} code={artefacts[file.key] ?? ""} language={file.language} filename={file.name} maxHeight={220} /> : null))}
								</div>
							</CardContent>
						</Card>
					) : null}

					{unread.length > 0 || audit.skipped > 0 ? (
						<Card>
							<CardHeader icon={<SkippedMark />} title="Not checked" description={audit.skipped > 0 ? `${audit.skipped} more pages were not checked, because an audit reads 25 pages at most.` : undefined} />
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
