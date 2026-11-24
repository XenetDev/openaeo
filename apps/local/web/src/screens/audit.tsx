import type { ArtefactsView, AuditView, FindingView } from "@openaeo/ui";
import { useState } from "react";
import { EmptyState } from "@/components/app-shell";
import { AgentFindings, type Finding, type FindingAgent } from "@/components/ui/agent-findings-clean";
import { Button } from "@/components/ui/button-clean";
import { StatCard } from "@/components/ui/stat-card-clean";
import { TextField } from "@/components/ui/text-field-clean";
import { Head, when } from "./shared";

type Props = {
	audit: AuditView | null;
	findings: FindingView[];
	artefacts: ArtefactsView;
	defaultUrl: string;
	copied: boolean;
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
	{ id: "high", label: "High", tone: "bad", note: "These stop AI engines from reading or using the site." },
	{ id: "medium", label: "Medium", tone: undefined, note: "These make pages harder for engines to quote and trust." },
	{ id: "low", label: "Low", tone: undefined, note: "Smaller improvements." },
] as const;
const FILES: { key: keyof ArtefactsView; name: string }[] = [
	{ key: "robotsTxt", name: "robots.txt" },
	{ key: "llmsTxt", name: "llms.txt" },
	{ key: "organizationJsonLd", name: "Organization JSON-LD for the home page" },
];

const pathOf = (url: string) => {
	try {
		return new URL(url).pathname || "/";
	} catch {
		return url;
	}
};

export function AuditScreen({ audit, findings, artefacts, defaultUrl, copied, onRun, onCancel, onCopyBrief }: Props) {
	const [url, setUrl] = useState(defaultUrl);
	const running = audit?.status === "running";
	const unread = audit?.pages.filter((p) => p.error) ?? [];
	const read = (audit?.pages.length ?? 0) - unread.length;
	const at = audit?.finishedAt ?? audit?.startedAt ?? 0;

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
		<div className="oa-view">
			<Head
				section="Audit"
				title="Can AI engines read and quote your site?"
				sub="Reads up to 25 pages in a few seconds. It uses no AI calls."
				actions={
					audit?.status === "done" && audit.own !== false && findings.length > 0 ? (
						<Button variant="secondary" size="sm" onClick={onCopyBrief}>
							{copied ? "Copied" : "Copy fix brief for your AI agent"}
						</Button>
					) : undefined
				}
			/>

			<form
				className="oa-actions"
				style={{ marginBottom: 16, alignItems: "flex-end" }}
				onSubmit={(e) => {
					e.preventDefault();
					if (!running) onRun(url.trim());
				}}
			>
				<div style={{ flex: 1, maxWidth: 420 }}>
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

			{!audit ? (
				<EmptyState title="No audit yet" text="An audit checks what AI engines need: access for their crawlers, content present without JavaScript, structured data and direct answers." />
			) : running ? (
				<p className="oa-dim" role="status">
					Reading {audit.origin}…
				</p>
			) : audit.status === "interrupted" ? (
				<p className="oa-alert">The last audit of {audit.origin} stopped before it finished. Run it again.</p>
			) : (
				<>
					{audit.own === false ? <p className="oa-alert">This audit is of {audit.origin}, which is not your project's website. It is shown for comparison and is not used for your fix brief.</p> : null}
					<div className="oa-grid oa-grid-3">
						<StatCard label="Audit score" value={audit.score ?? 0} format={(n) => `${Math.round(n)} / 100`} changeLabel="a rough guide, not a prediction" />
						<StatCard label="Pages read" value={read} changeLabel={unread.length > 0 ? `${unread.length} could not be read` : "all readable"} />
						<StatCard label="Findings" value={findings.length} changeLabel={`${findings.filter((f) => f.severity === "high").length} high · ${when(audit.startedAt)}`} />
					</div>

					{findings.length === 0 ? (
						<EmptyState title="No problems found" text="Every check passed on the pages read." />
					) : (
						<>
							<div style={{ marginBottom: 12 }}>
								<AgentFindings title={`Checks on ${audit.origin.replace(/^https?:\/\//, "")}`} agents={agents} findings={feed} rows={Math.min(6, feed.length)} now={at} />
							</div>
							{LEVELS.map((level) => {
								const groups = new Map<string, FindingView[]>();
								for (const finding of findings.filter((f) => f.severity === level.id)) groups.set(finding.title, [...(groups.get(finding.title) ?? []), finding]);
								if (groups.size === 0) return null;
								return (
									<section key={level.id} className="oa-card">
										<h2 className="oa-cap">
											<span>
												<span className="oa-tag" data-tone={level.tone} style={{ marginLeft: 0, marginRight: 8 }}>
													{level.label}
												</span>
												{level.note}
											</span>
										</h2>
										{[...groups.entries()].map(([title, group]) => (
											<article key={title} className="oa-finding">
												<h3>
													{title}
													{group.length > 1 ? <span className="oa-dim"> · {group.length} pages</span> : null}
												</h3>
												<p>{group[0]?.evidence}</p>
												<pre className="oa-code">{group[0]?.fix}</pre>
												<ul className="oa-urls">
													{group.slice(0, 6).map((f) => (
														<li key={f.url}>{f.url}</li>
													))}
													{group.length > 6 ? <li>and {group.length - 6} more</li> : null}
												</ul>
											</article>
										))}
									</section>
								);
							})}
						</>
					)}

					{FILES.some((f) => artefacts[f.key]) ? (
						<section className="oa-card">
							<h2 className="oa-cap">
								Starter files <span>drafts to adapt, not to paste blindly</span>
							</h2>
							{FILES.map((file) =>
								artefacts[file.key] ? (
									<details key={file.key}>
										<summary>{file.name}</summary>
										<pre className="oa-code">{artefacts[file.key]}</pre>
									</details>
								) : null,
							)}
						</section>
					) : null}

					{unread.length > 0 || audit.skipped > 0 ? (
						<section className="oa-card">
							<h2 className="oa-cap">Not checked</h2>
							<ul className="oa-urls">
								{unread.slice(0, 10).map((p) => (
									<li key={p.url}>
										{p.url} · {p.error}
									</li>
								))}
							</ul>
							{audit.skipped > 0 ? <p className="oa-note">{audit.skipped} more pages were not checked, because an audit reads 25 pages at most.</p> : null}
						</section>
					) : null}
				</>
			)}
		</div>
	);
}
