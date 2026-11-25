import { type AuditResult, type Fetched, runAudit } from "@openaeo/engine";
import { AuditError, type AuditService, toOrigin } from "./audits";
import { ENGINE_LABELS } from "./engine-catalog";
import { formatAudit, formatReport } from "./format";
import { buildReport } from "./report";
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

export type RunOnceDeps = {
	store: Store;
	runs: RunService;
	out: (line: string) => void;
	json: boolean;
	project?: string;
};

export async function runOnce(deps: RunOnceDeps): Promise<number> {
	const { store, runs, out } = deps;
	const projects = await store.projects.list();
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
		runId = (await runs.start(project.id)).id;
	} catch (error) {
		if (!(error instanceof RunError)) throw error;
		out(error.message);
		return 1;
	}
	if (!deps.json)
		out(
			`Running ${(await store.prompts.list(project.id)).filter((p) => p.active).length} prompts for ${project.name}…`,
		);
	const finished = await runs.wait(runId);
	const answers = await store.answers.listByRun(runId);
	const failures = answers.filter((a) => a.errorCode !== null);
	const report = await buildReport(store, project.id, { runId });
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
	const projects = await store.projects.list();
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
			const audit = await deps.audits.wait((await deps.audits.start(project.id, deps.url)).id);
			if (audit.status !== "done") {
				out("The audit was interrupted before it finished.");
				return 1;
			}
			result = {
				origin: audit.origin,
				score: audit.score ?? 0,
				pages: audit.pages,
				findings: await store.audits.findings(audit.id),
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
