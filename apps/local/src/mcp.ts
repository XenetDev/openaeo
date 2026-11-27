import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuditService } from "./audits";
import { engineLabel } from "./format";
import { registerAnswerTools } from "./mcp/answers";
import { registerAuditTools } from "./mcp/audit";
import { registerBrandTools } from "./mcp/brand";
import { type CompetitorDeps, registerCompetitorTools } from "./mcp/competitors";
import { registerInsightTools } from "./mcp/insights";
import { registerOverviewTools } from "./mcp/overview";
import { registerPlanTools } from "./mcp/plan";
import { type PostsDeps, registerPostTools } from "./mcp/posts";
import { type QuestionDeps, registerQuestionTools } from "./mcp/questions";
import { type RunDeps, registerRunTools } from "./mcp/runs";
import { fail, type McpContext, type McpLimits, type McpWords, type Reply } from "./mcp/shared";
import type { Project, Store } from "./store/types";

const LOCAL_WORDS: McpWords = {
	noProject: "There is no project yet. Ask the user to run `openaeo` and set up their brand in the dashboard first.",
	noProjectYet: "There is no project yet. The user sets one up by running `openaeo` and filling in the dashboard.",
	listProjects:
		"List the brands OpenAEO is tracking on this computer, with their websites, question counts and latest run and audit.",
	runPrompts:
		"Start a run that asks every AI engine all of a brand's active questions. This uses the user's AI subscriptions and takes about half a minute per question. Returns immediately; read results with get_report.",
	schedule: "Automatic runs only happen while OpenAEO is open on this computer.",
};

export type { McpLimits, McpWords };
export type McpDeps = CompetitorDeps &
	RunDeps &
	PostsDeps &
	Pick<QuestionDeps, "suggest"> & {
		store: Store;
		audits: AuditService;
		version: string;
		words?: Partial<McpWords>;
		limits?: McpLimits;
		engineLabel?: (engine: string) => string;
	};

export function createMcpServer(deps: McpDeps): McpServer {
	const { store } = deps;
	const words = { ...LOCAL_WORDS, ...deps.words };
	const server = new McpServer({ name: "openaeo", version: deps.version });

	async function resolve(name: string | undefined): Promise<Project | Reply> {
		const projects = await store.projects.list();
		if (projects.length === 0) return fail(words.noProject);
		if (!name) return projects[0] as Project;
		const found = projects.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
		return found ?? fail(`There is no project named "${name}". Projects: ${projects.map((p) => p.name).join(", ")}.`);
	}

	const context: McpContext = { server, store, resolve, label: deps.engineLabel ?? engineLabel, words };
	registerBrandTools(context, deps.limits);
	registerOverviewTools(context);
	registerAnswerTools(context);
	registerInsightTools(context);
	registerAuditTools(context, deps.audits);
	registerPlanTools(context);
	registerRunTools(context, deps);
	registerCompetitorTools(context, deps);
	registerQuestionTools(context, deps);
	registerPostTools(context, deps);

	return server;
}
