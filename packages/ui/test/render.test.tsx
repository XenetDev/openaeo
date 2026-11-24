import { expect, test } from "bun:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswersPage, AppShell, AuditPage, CompetitorsPage, Onboarding, Overview, PromptsPage, SettingsPage, SourcesPage } from "../src/index";
import { byLine } from "../src/format";
import { answers, emptyReport, engines, project, prompts, report } from "./sample";

const html = (element: ReactElement) => renderToStaticMarkup(element);
const noop = () => {};

test("the shell lists every page and marks the current one", () => {
	const out = html(
		<AppShell projects={[project]} project={project} page="answers" onNavigate={noop} onSelectProject={noop} onNewProject={noop}>
			<p>body</p>
		</AppShell>,
	);
	for (const label of ["Overview", "Prompts", "Answers", "Sources", "Competitors", "Settings"]) expect(out).toContain(label);
	expect(out).toMatch(/aria-current="page"[^>]*>.{0,80}?Answers</);
	expect(out).toContain("Pipedrive");
	expect(out).toContain("<p>body</p>");
});

test("overview shows the score, the headline numbers and each engine", () => {
	const out = html(<Overview project={project} report={report} engines={engines} onRun={noop} onCancel={noop} onNavigate={noop} />);
	expect(out).toContain("77.3");
	expect(out).toContain("100%");
	expect(out).toContain("50%");
	expect(out).toContain("1.3");
	expect(out).toContain("Claude");
	expect(out).toContain("ChatGPT (Codex)");
	expect(out).toContain("65.8");
	expect(out).toContain("1 failed");
	expect(out).toContain("Run now");
	expect(out).not.toMatch(/what ChatGPT users see/i);
});

test("overview with no runs says what to do next", () => {
	const out = html(<Overview project={project} report={emptyReport} engines={engines} onRun={noop} onCancel={noop} onNavigate={noop} />);
	expect(out).toMatch(/No runs yet/);
	expect(out).toContain("Run now");
	expect(out).not.toContain("NaN");
});

test("overview during a run shows progress and a way to stop", () => {
	const running = { ...report, run: { id: "r3", status: "running" as const, startedAt: 1, finishedAt: null, total: 8, completed: 3 } };
	const out = html(<Overview project={project} report={running} engines={engines} onRun={noop} onCancel={noop} onNavigate={noop} />);
	expect(out).toContain("3 of 8");
	expect(out).toContain("Stop");
	expect(out).not.toContain("Run now");
});

test("overview says so when no engine can run", () => {
	const none = engines.map((e) => ({ ...e, available: false, reason: `${e.label} is missing.` }));
	const out = html(<Overview project={project} report={emptyReport} engines={none} onRun={noop} onCancel={noop} onNavigate={noop} />);
	expect(out).toContain("Claude is missing.");
	expect(out).toMatch(/disabled=""[^>]*>[^<]*Run now|Run now<\/button>/);
});

test("overview shows an interrupted run as interrupted", () => {
	const stopped = { ...report, run: { ...report.run, status: "interrupted" as const, id: "r9", startedAt: 1, finishedAt: 2, total: 8, completed: 3 } };
	expect(html(<Overview project={project} report={stopped} engines={engines} onRun={noop} onCancel={noop} onNavigate={noop} />)).toMatch(/interrupted/i);
});

test("prompts are listed, escaped, and paused ones are marked", () => {
	const out = html(<PromptsPage prompts={prompts} onAdd={noop} onToggle={noop} onRemove={noop} />);
	expect(out).toContain("What is the best CRM for small marketing agencies?");
	expect(out).toContain("&lt;script&gt;");
	expect(out).not.toContain("<script>alert");
	expect(out).toMatch(/Paused/);
	expect(html(<PromptsPage prompts={[]} onAdd={noop} onToggle={noop} onRemove={noop} />)).toMatch(/Add the questions/);
});

test("answers show text safely, highlight brands, list citations and explain errors", () => {
	const out = html(<AnswersPage answers={answers} project={project} competitors={["HubSpot"]} engines={engines} />);
	expect(out).toContain("<mark");
	expect(out).toMatch(/<mark[^>]*data-brand="true"[^>]*>Pipedrive<\/mark>/);
	expect(out).toMatch(/<mark[^>]*>HubSpot<\/mark>/);
	expect(out).not.toContain("<img");
	expect(out).toContain("&lt;img");
	expect(out).toContain('href="https://attio.com/f/best-crm"');
	expect(out).toContain('rel="noreferrer noopener"');
	expect(out).toContain("Update the Codex CLI and try again.");
	expect(out).toContain("ChatGPT (Codex)");
	expect(out).toMatch(/Mentioned 2nd/);
	expect(html(<AnswersPage answers={[]} project={project} competitors={[]} engines={engines} />)).toMatch(/No answers yet/);
});

test("a citation with a non-http address is never rendered as a link", () => {
	const bad = [{ ...answers[0], id: "b", citations: [{ url: "javascript:alert(1)", domain: "x", title: "bad" }] }] as typeof answers;
	expect(html(<AnswersPage answers={bad} project={project} competitors={[]} engines={engines} />)).not.toContain('href="javascript:');
});

test("sources list cited sites and flag the brand's own", () => {
	const out = html(<SourcesPage report={report} />);
	expect(out).toContain("attio.com");
	expect(out).toContain("pipedrive.com");
	expect(out).toMatch(/Yours/);
	expect(html(<SourcesPage report={emptyReport} />)).toMatch(/No sources yet/);
});

test("competitors table shows everyone with the brand marked", () => {
	const out = html(<CompetitorsPage report={report} competitors={[{ name: "HubSpot", aliases: [], domains: [] }]} onSave={noop} />);
	expect(out).toContain("HubSpot");
	expect(out).toMatch(/Pipedrive[^<]*(<[^>]+>)*[^<]*You/);
	expect(out).toContain("Not mentioned");
});

test("settings show engine availability and reasons, and never a full key", () => {
	const out = html(
		<SettingsPage engines={engines} settings={{ "openai.apiKey": "••••1234", schedule: "daily" }} project={project} onSave={noop} onSaveProject={noop} onDeleteProject={noop} />,
	);
	expect(out).toContain("Ready");
	expect(out).toContain("Add an OpenAI API key in Settings to use this engine.");
	expect(out).toContain("••••1234");
	expect(out).toContain("Pipedrive");
});

test("onboarding asks for the brand, site, competitors and prompts and reports engine problems", () => {
	const out = html(<Onboarding engines={engines} onCreate={noop} busy={false} error={null} />);
	for (const label of ["Brand name", "Website", "Competitors", "Questions"]) expect(out).toContain(label);
	expect(out).toContain("Claude");
	const none = engines.map((e) => ({ ...e, available: false, reason: `${e.label} is not installed.` }));
	const blocked = html(<Onboarding engines={none} onCreate={noop} busy={false} error={"That name is taken"} />);
	expect(blocked).toContain("Claude is not installed.");
	expect(blocked).toContain("That name is taken");
});

test("an answer shows the tone towards the brand when known", () => {
	const toned = [{ ...answers[0], sentiment: "negative" as const }] as typeof answers;
	const out = html(<AnswersPage answers={toned} project={project} competitors={[]} engines={engines} />);
	expect(out).toMatch(/negative tone/i);
	expect(html(<AnswersPage answers={answers} project={project} competitors={[]} engines={engines} />)).not.toMatch(/tone/i);
});

test("suggested questions fill the box for review, with a note when they are generic", () => {
	const out = html(<PromptsPage prompts={[]} onAdd={noop} onToggle={noop} onRemove={noop} onSuggest={noop} suggestions={{ prompts: ["Best CRM?", "Cheapest CRM?"], fallback: true }} />);
	expect(out).toContain("Best CRM?\nCheapest CRM?");
	expect(out).toMatch(/generic starting points/i);
	expect(out).toContain("Suggest questions");
	expect(out).toContain("Add 2 questions");
});

test("a run where every answer failed says why instead of 'no runs yet'", () => {
	const failed = {
		...emptyReport,
		run: { id: "r", status: "done" as const, startedAt: 1, finishedAt: 2, total: 2, completed: 2 },
		problems: [{ engine: "claude-cli", message: "Claude Code is not logged in. Run `claude` and use /login, then try again.", count: 2 }],
	};
	const out = html(<Overview project={project} report={failed} engines={engines} onRun={noop} onCancel={noop} onNavigate={noop} />);
	expect(out).not.toMatch(/No runs yet/);
	expect(out).toMatch(/got no answers/i);
	expect(out).toContain("Claude Code is not logged in.");
	expect(out).toContain("Claude");
});

test("a partly failed run still shows results and lists what failed", () => {
	const partial = { ...report, problems: [{ engine: "codex-cli", message: "Update the Codex CLI and try again.", count: 1 }] };
	const out = html(<Overview project={project} report={partial} engines={engines} onRun={noop} onCancel={noop} onNavigate={noop} />);
	expect(out).toContain("77.3");
	expect(out).toContain("Update the Codex CLI and try again.");
});

test("competitor names keep their commas", () => {
	expect(html(<CompetitorsPage report={report} competitors={[{ name: "Acme, Inc.", aliases: [], domains: [] }]} onSave={noop} />)).toContain("Acme, Inc.");
	expect(byLine("Acme, Inc.\n  HubSpot \n\n")).toEqual(["Acme, Inc.", "HubSpot"]);
});

const auditDone = { id: "a1", origin: "https://pipedrive.com", status: "done" as const, startedAt: 1_700_000_000_000, finishedAt: 1_700_000_004_000, score: 64, pages: [{ url: "https://pipedrive.com/", status: 200, words: 900 }, { url: "https://pipedrive.com/x", status: 403, words: 0, error: "The server answered with status 403." }], skipped: 12 };
const auditFindings = [
	{ checkId: "crawler-blocked", severity: "high" as const, url: "https://pipedrive.com/robots.txt", title: "robots.txt blocks OAI-SearchBot (OpenAI)", evidence: "OAI-SearchBot builds the index.", fix: "Add this group to robots.txt:\nUser-agent: OAI-SearchBot\nAllow: /" },
	{ checkId: "no-structured-data", severity: "medium" as const, url: "https://pipedrive.com/", title: "The page has no structured data", evidence: "<script>alert(1)</script> No JSON-LD was found.", fix: "Add JSON-LD." },
	{ checkId: "no-structured-data", severity: "medium" as const, url: "https://pipedrive.com/pricing", title: "The page has no structured data", evidence: "No JSON-LD was found.", fix: "Add JSON-LD." },
	{ checkId: "llms-txt-missing", severity: "low" as const, url: "https://pipedrive.com/llms.txt", title: "No llms.txt file", evidence: "Disputed.", fix: "Optionally add /llms.txt." },
];

test("the audit page shows the score, grouped findings with fixes, and pages it could not read", () => {
	const out = html(<AuditPage audit={auditDone} findings={auditFindings} artefacts={{ robotsTxt: "User-agent: GPTBot\nAllow: /" }} defaultUrl="pipedrive.com" onRun={noop} onCancel={noop} onCopyBrief={noop} />);
	expect(out).toContain("64");
	expect(out).toContain("robots.txt blocks OAI-SearchBot (OpenAI)");
	expect(out).toContain("User-agent: OAI-SearchBot");
	expect(out).toMatch(/2 pages/);
	expect(out).toContain("https://pipedrive.com/pricing");
	expect(out).not.toContain("<script>alert");
	expect(out).toContain("The server answered with status 403.");
	expect(out).toContain("12 more pages were not checked");
	expect(out).toContain("Copy fix brief");
	expect(out.indexOf("High")).toBeLessThan(out.indexOf("Medium"));
	expect(out.indexOf("Medium")).toBeLessThan(out.indexOf("Low"));
	expect(out).toContain("User-agent: GPTBot");
});

test("the audit page before any audit, during one, and after a clean one", () => {
	const none = html(<AuditPage audit={null} findings={[]} artefacts={{}} defaultUrl="pipedrive.com" onRun={noop} onCancel={noop} onCopyBrief={noop} />);
	expect(none).toMatch(/No audit yet/);
	expect(none).toContain('value="pipedrive.com"');
	expect(none).toContain("Run audit");
	const running = html(<AuditPage audit={{ ...auditDone, status: "running", finishedAt: null, score: null, pages: [] }} findings={[]} artefacts={{}} defaultUrl="" onRun={noop} onCancel={noop} onCopyBrief={noop} />);
	expect(running).toMatch(/Reading https:\/\/pipedrive.com/);
	expect(running).toContain("Stop");
	const clean = html(<AuditPage audit={{ ...auditDone, score: 100, pages: [auditDone.pages[0] as (typeof auditDone.pages)[0]], skipped: 0 }} findings={[]} artefacts={{}} defaultUrl="" onRun={noop} onCancel={noop} onCopyBrief={noop} />);
	expect(clean).toMatch(/No problems found/);
	const stopped = html(<AuditPage audit={{ ...auditDone, status: "interrupted", score: null }} findings={[]} artefacts={{}} defaultUrl="" onRun={noop} onCancel={noop} onCopyBrief={noop} />);
	expect(stopped).toMatch(/stopped before it finished/i);
});

test("the shell links to the audit page", () => {
	const out = html(<AppShell projects={[project]} project={project} page="audit" onNavigate={noop} onSelectProject={noop} onNewProject={noop}><p>x</p></AppShell>);
	expect(out).toMatch(/aria-current="page"[^>]*>.{0,80}?Audit</);
});
