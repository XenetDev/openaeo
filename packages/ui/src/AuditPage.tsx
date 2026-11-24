"use client";
import { useState } from "react";
import { when } from "./format";
import type { ArtefactsView, AuditView, FindingView } from "./types";

export type AuditPageProps = {
	audit: AuditView | null;
	findings: FindingView[];
	artefacts: ArtefactsView;
	defaultUrl: string;
	onRun: (url: string) => void;
	onCancel: () => void;
	onCopyBrief: () => void;
	copied?: boolean;
	error?: string | null;
};

const LEVELS = [
	{ id: "high", label: "High", note: "These stop AI engines from reading or using the site." },
	{ id: "medium", label: "Medium", note: "These make pages harder for engines to quote and trust." },
	{ id: "low", label: "Low", note: "Smaller improvements." },
] as const;

const FILES: { key: keyof ArtefactsView; name: string }[] = [
	{ key: "robotsTxt", name: "robots.txt" },
	{ key: "llmsTxt", name: "llms.txt" },
	{ key: "organizationJsonLd", name: "Organization JSON-LD for the home page" },
];

export function AuditPage({ audit, findings, artefacts, defaultUrl, onRun, onCancel, onCopyBrief, copied, error }: AuditPageProps) {
	const [url, setUrl] = useState(defaultUrl);
	const running = audit?.status === "running";
	const unread = audit?.pages.filter((p) => p.error) ?? [];
	const read = (audit?.pages.length ?? 0) - unread.length;

	return (
		<div className="oa-page">
			<header className="oa-head">
				<div>
					<p className="oa-eyebrow">Audit</p>
					<h1 className="oa-title">Can AI engines read and quote your site?</h1>
				</div>
				{audit?.status === "done" && findings.length > 0 ? (
					<div className="oa-actions">
						<button type="button" className="oa-button oa-button-quiet" onClick={onCopyBrief}>
							{copied ? "Copied" : "Copy fix brief for your AI agent"}
						</button>
					</div>
				) : null}
			</header>

			{error ? (
				<p className="oa-alert" role="alert">
					{error}
				</p>
			) : null}

			<form
				className="oa-form oa-form-row"
				onSubmit={(e) => {
					e.preventDefault();
					if (!running) onRun(url.trim());
				}}
			>
				<label className="oa-label" htmlFor="oa-audit-url">
					Website to check
				</label>
				<div className="oa-actions">
					<input id="oa-audit-url" className="oa-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com" disabled={running} />
					{running ? (
						<button type="button" className="oa-button oa-button-quiet" onClick={onCancel}>
							Stop
						</button>
					) : (
						<button type="submit" className="oa-button" disabled={url.trim() === ""}>
							Run audit
						</button>
					)}
				</div>
			</form>

			{!audit ? (
				<section className="oa-empty">
					<h2>No audit yet</h2>
					<p>An audit reads up to 25 pages of the site and checks what AI engines need: access for their crawlers, content present without JavaScript, structured data, and direct answers. It takes a few seconds and uses no AI calls.</p>
				</section>
			) : running ? (
				<p className="oa-progress" role="status">
					Reading {audit.origin}…
				</p>
			) : audit.status === "interrupted" ? (
				<p className="oa-alert">The last audit of {audit.origin} stopped before it finished. Run it again.</p>
			) : (
				<>
					<section className="oa-hero">
						<div className="oa-score">
							<p className="oa-eyebrow">Audit score</p>
							<p className="oa-score-value">
								{audit.score ?? 0}
								<span>/100</span>
							</p>
							<p className="oa-muted">
								{audit.origin} · {when(audit.startedAt)}
							</p>
						</div>
						<dl className="oa-tiles oa-tiles-3">
							<div className="oa-tile">
								<dt>Pages read</dt>
								<dd>{read}</dd>
								<p>{unread.length > 0 ? `${unread.length} could not be read` : "all readable"}</p>
							</div>
							<div className="oa-tile">
								<dt>Findings</dt>
								<dd>{findings.length}</dd>
								<p>{findings.filter((f) => f.severity === "high").length} high</p>
							</div>
							<div className="oa-tile">
								<dt>Kinds of problem</dt>
								<dd>{new Set(findings.map((f) => f.title)).size}</dd>
								<p>each with a fix below</p>
							</div>
						</dl>
					</section>

					{findings.length === 0 ? (
						<section className="oa-empty">
							<h2>No problems found</h2>
							<p>Every check passed on the pages read.</p>
						</section>
					) : (
						LEVELS.map((level) => {
							const groups = new Map<string, FindingView[]>();
							for (const finding of findings.filter((f) => f.severity === level.id)) groups.set(finding.title, [...(groups.get(finding.title) ?? []), finding]);
							if (groups.size === 0) return null;
							return (
								<section key={level.id} className="oa-section">
									<h2 className="oa-h2">
										<span className="oa-tag" data-level={level.id}>
											{level.label}
										</span>{" "}
										{level.note}
									</h2>
									{[...groups.entries()].map(([title, group]) => (
										<article key={title} className="oa-finding">
											<h3 className="oa-finding-title">
												{title}
												{group.length > 1 ? <span className="oa-muted"> · {group.length} pages</span> : null}
											</h3>
											<p className="oa-finding-evidence">{group[0]?.evidence}</p>
											<pre className="oa-code">{group[0]?.fix}</pre>
											<ul className="oa-finding-urls">
												{group.slice(0, 6).map((f) => (
													<li key={f.url}>{f.url}</li>
												))}
												{group.length > 6 ? <li>and {group.length - 6} more</li> : null}
											</ul>
										</article>
									))}
								</section>
							);
						})
					)}

					{FILES.some((f) => artefacts[f.key]) ? (
						<section className="oa-section">
							<h2 className="oa-h2">Starter files</h2>
							<p className="oa-muted">Drafts to adapt, not to paste blindly. Keep any rules your current robots.txt needs.</p>
							{FILES.map((file) =>
								artefacts[file.key] ? (
									<details key={file.key} className="oa-details">
										<summary>{file.name}</summary>
										<pre className="oa-code">{artefacts[file.key]}</pre>
									</details>
								) : null,
							)}
						</section>
					) : null}

					{unread.length > 0 || audit.skipped > 0 ? (
						<section className="oa-section">
							<h2 className="oa-h2">Not checked</h2>
							<ul className="oa-finding-urls">
								{unread.slice(0, 10).map((p) => (
									<li key={p.url}>
										{p.url} <span className="oa-muted">{p.error}</span>
									</li>
								))}
							</ul>
							{audit.skipped > 0 ? <p className="oa-muted">{audit.skipped} more pages were not checked, because an audit reads 25 pages at most.</p> : null}
						</section>
					) : null}
				</>
			)}
		</div>
	);
}
