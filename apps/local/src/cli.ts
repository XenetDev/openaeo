import { type AuditResult, type Fetched, type Finding, runAudit } from "@openaeo/engine";
import { AuditError, type AuditService, toOrigin } from "./audits";
import { ENGINE_LABELS } from "./engines";
import { buildReport, type Report } from "./report";
import { RunError, type RunService } from "./runs";
import type { Store } from "./store/store";

export type Args =
	| {
			command: "serve" | "run" | "status" | "audit" | "mcp" | "version" | "help";
			open: boolean;
			json: boolean;
			project?: string;
			port?: number;
			url?: string;
	  }
	| { command: "error"; message: string };

const COMMANDS = new Set(["run", "status", "audit", "mcp", "help"]);

export function parseArgs(argv: string[]): Args {
	const fail = (message: string): Args => ({ command: "error", message: `${message} Run \`openaeo --help\`.` });
	const args: Exclude<Args, { command: "error" }> = { command: "serve", open: true, json: false };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i] as string;
		if (arg === "--version" || arg === "-v") args.command = "version";
		else if (arg === "--help" || arg === "-h") args.command = "help";
		else if (arg === "--no-open") args.open = false;
		else if (arg === "--json") args.json = true;
		else if (arg === "--project") {
			const value = argv[i + 1];
			if (!value || value.startsWith("-")) return fail("--project needs a project name.");
			args.project = value;
			i += 1;
		} else if (arg === "--port") {
			const value = Number(argv[i + 1]);
			if (!Number.isInteger(value) || value < 1 || value > 65535)
				return fail("--port needs a number between 1 and 65535.");
			args.port = value;
			i += 1;
		} else if (arg.startsWith("-")) return fail(`Unknown option "${arg}".`);
		else if (i === 0 && COMMANDS.has(arg)) args.command = arg as "run" | "status" | "audit" | "mcp" | "help";
		else if (args.command === "audit" && args.url === undefined) args.url = arg;
		else return fail(`Unknown command "${arg}".`);
	}
	return args;
}

export const HELP = `OpenAEO: see how AI answers talk about your brand.

Usage:
  openaeo                 Open the dashboard in your browser
  openaeo run             Run all active prompts now and print a report
  openaeo audit [url]     Check a website against AEO rules and print the findings
  openaeo status          Show projects and which AI engines are available
  openaeo mcp             Run the connection your AI agent uses (see Settings)

Options:
  --project <name>        Project to run (default: the first one)
  --json                  Print the report as JSON
  --no-open               Start the dashboard without opening a browser
  --port <number>         Port for the dashboard (default: 4747)
  --version, --help`;

const percent = (value: number) => `${Math.round(value * 100)}%`;
const pad = (value: string, width: number) => value.padEnd(width);

export function formatReport(name: string, report: Report): string {
	const m = report.overall.metrics;
	const lines = [
		`OpenAEO · ${name}`,
		"",
		`${pad("Visibility", 18)}${report.overall.visibility} / 100`,
		`${pad("Mentioned in", 18)}${percent(m.mentionRate)} of ${m.answers} answers`,
		`${pad("Own site cited in", 18)}${percent(m.citationRate)} of answers`,
		`${pad("Average position", 18)}${m.averageRank === null ? "not mentioned" : m.averageRank.toFixed(1)}`,
		"",
		`${pad("Engine", 20)}${pad("Visibility", 12)}${pad("Mentioned", 11)}${pad("Cited", 8)}Errors`,
		...report.engines.map(
			(e) =>
				`${pad(ENGINE_LABELS[e.engine] ?? e.engine, 20)}${pad(String(e.visibility), 12)}${pad(percent(e.metrics.mentionRate), 11)}${pad(percent(e.metrics.citationRate), 8)}${e.errors}`,
		),
		"",
		`${pad("Who gets mentioned", 26)}${pad("Share of answers", 18)}Average position`,
		...report.competitors.map(
			(c) =>
				`${pad(c.isBrand ? `${c.name} (you)` : c.name, 26)}${pad(percent(c.mentionRate), 18)}${c.averageRank === null ? "-" : c.averageRank.toFixed(1)}`,
		),
	];
	if (report.topDomains.length) {
		lines.push(
			"",
			"Most cited sites",
			...report.topDomains
				.slice(0, 8)
				.map((d) => `${pad(d.isBrand ? `${d.domain} (yours)` : d.domain, 40)}${d.citations}`),
		);
	}
	return lines.join("\n");
}

export type RunOnceDeps = {
	store: Store;
	runs: RunService;
	out: (line: string) => void;
	json: boolean;
	project?: string;
};

export async function runOnce(deps: RunOnceDeps): Promise<number> {
	const { store, runs, out } = deps;
	const projects = store.projects.list();
	const project = deps.project
		? projects.find((p) => p.name.toLowerCase() === deps.project?.toLowerCase())
		: projects[0];
	if (!project) {
		out(
			deps.project
				? `There is no project named "${deps.project}".`
				: "There is no project yet. Run `openaeo` and set one up in the dashboard first.",
		);
		return 1;
	}
	let runId: string;
	try {
		runId = runs.start(project.id).id;
	} catch (error) {
		if (!(error instanceof RunError)) throw error;
		out(error.message);
		return 1;
	}
	if (!deps.json)
		out(`Running ${store.prompts.list(project.id).filter((p) => p.active).length} prompts for ${project.name}…`);
	const finished = await runs.wait(runId);
	const answers = store.answers.listByRun(runId);
	const failures = answers.filter((a) => a.errorCode !== null);
	const report = buildReport(store, project.id, { runId });
	if (deps.json) {
		out(JSON.stringify(report, null, 2));
	} else {
		out(formatReport(project.name, report));
		const problems = [
			...new Set(failures.map((a) => `${ENGINE_LABELS[a.engine] ?? a.engine}: ${a.errorMessage ?? a.errorCode}`)),
		];
		if (problems.length) out(["", "Problems", ...problems.map((p) => `  ${p}`)].join("\n"));
		if (finished.status === "interrupted") out("\nThe run was interrupted before it finished.");
	}
	return answers.length > 0 && failures.length < answers.length ? 0 : 1;
}

const SEVERITIES = ["high", "medium", "low"] as const;

export function formatAudit(result: Pick<AuditResult, "origin" | "score" | "pages" | "findings">): string {
	const read = result.pages.filter((p) => !p.error).length;
	const lines = [
		`OpenAEO audit · ${result.origin}`,
		"",
		`${pad("Score", 18)}${result.score} / 100`,
		`${pad("Pages read", 18)}${read} of ${result.pages.length}`,
		`${pad("Findings", 18)}${result.findings.length}`,
	];
	for (const severity of SEVERITIES) {
		const groups = new Map<string, Finding[]>();
		for (const finding of result.findings.filter((f) => f.severity === severity))
			groups.set(finding.title, [...(groups.get(finding.title) ?? []), finding]);
		if (groups.size === 0) continue;
		lines.push("", severity.toUpperCase());
		for (const [title, findings] of groups) {
			const first = findings[0] as Finding;
			lines.push(
				`  ${title}${findings.length > 1 ? ` (${findings.length} pages)` : ""}`,
				`    ${first.url}`,
				...first.fix.split("\n").map((line, i) => `    ${i === 0 ? "Fix: " : "     "}${line}`),
			);
		}
	}
	if (result.findings.length === 0) lines.push("", "No problems found.");
	const unread = result.pages.filter((p) => p.error);
	if (unread.length) lines.push("", "Could not read", ...unread.slice(0, 10).map((p) => `  ${p.url}  ${p.error}`));
	return lines.join("\n");
}

export type AuditOnceDeps = {
	store: Store;
	audits: AuditService;
	get: (url: string) => Promise<Fetched>;
	out: (line: string) => void;
	json: boolean;
	url?: string;
	project?: string;
};

export async function auditOnce(deps: AuditOnceDeps): Promise<number> {
	const { store, out } = deps;
	const projects = store.projects.list();
	const project = deps.project
		? projects.find((p) => p.name.toLowerCase() === deps.project?.toLowerCase())
		: projects[0];
	if (deps.project && !project) {
		out(`There is no project named "${deps.project}".`);
		return 1;
	}
	let result: Pick<AuditResult, "origin" | "score" | "pages" | "findings">;
	if (project) {
		try {
			const audit = await deps.audits.wait(deps.audits.start(project.id, deps.url).id);
			if (audit.status !== "done") {
				out("The audit was interrupted before it finished.");
				return 1;
			}
			result = {
				origin: audit.origin,
				score: audit.score ?? 0,
				pages: audit.pages,
				findings: store.audits.findings(audit.id),
			};
		} catch (error) {
			if (!(error instanceof AuditError)) throw error;
			out(error.message);
			return 1;
		}
	} else {
		const origin = deps.url ? toOrigin(deps.url) : null;
		if (!origin) {
			out(
				deps.url
					? `"${deps.url.slice(0, 100)}" is not a web address OpenAEO can audit.`
					: "Give an address to audit, for example: openaeo audit example.com",
			);
			return 1;
		}
		result = await runAudit({ url: origin, get: deps.get });
	}
	out(deps.json ? JSON.stringify(result, null, 2) : formatAudit(result));
	return result.findings.some((f) => f.checkId === "site-unreachable") ? 1 : 0;
}
