import type { AnswerView, EngineInfo, ProjectView, PromptView, ReportView } from "../src/types";

export const engines: EngineInfo[] = [
	{ id: "claude-cli", label: "Claude", available: true, reason: null, enabled: true },
	{ id: "codex-cli", label: "ChatGPT (Codex)", available: true, reason: null, enabled: true },
	{ id: "openai", label: "OpenAI API", available: false, reason: "Add an OpenAI API key in Settings to use this engine.", enabled: true },
];

export const project: ProjectView = { id: "p1", name: "Pipedrive", aliases: [], domains: ["pipedrive.com"] };

export const prompts: PromptView[] = [
	{ id: "a", text: "What is the best CRM for small marketing agencies?", active: true },
	{ id: "b", text: "Cheapest CRM <script>alert(1)</script>", active: false },
];

const m = (mentionRate: number, averageRank: number | null, citationRate: number) => ({
	answers: 4,
	mentionRate,
	averageRank,
	rankScore: averageRank ? mentionRate * (2 / (averageRank + 1)) : 0,
	shareOfVoice: 0.3,
	citationRate,
});

export const report: ReportView = {
	run: { id: "r2", status: "done", startedAt: 1_700_000_100_000, finishedAt: 1_700_000_160_000, total: 4, completed: 4 },
	overall: { metrics: m(1, 1.3, 0.5), visibility: 77.3 },
	engines: [
		{ engine: "claude-cli", metrics: m(1, 1.5, 0), visibility: 65.8, errors: 0 },
		{ engine: "codex-cli", metrics: m(1, 1, 1), visibility: 89.3, errors: 1 },
	],
	competitors: [
		{ name: "Pipedrive", mentionRate: 1, averageRank: 1.3, isBrand: true },
		{ name: "HubSpot", mentionRate: 1, averageRank: 2, isBrand: false },
		{ name: "Attio", mentionRate: 0, averageRank: null, isBrand: false },
	],
	topDomains: [
		{ domain: "attio.com", citations: 3, isBrand: false },
		{ domain: "pipedrive.com", citations: 2, isBrand: true },
	],
	trend: [
		{ runId: "r1", startedAt: 1_700_000_000_000, visibility: 52.1, mentionRate: 0.5 },
		{ runId: "r2", startedAt: 1_700_000_100_000, visibility: 77.3, mentionRate: 1 },
	],
};

export const emptyReport: ReportView = {
	run: null,
	overall: { metrics: { answers: 0, mentionRate: 0, averageRank: null, rankScore: 0, shareOfVoice: 0, citationRate: 0 }, visibility: 0 },
	engines: [],
	competitors: [{ name: "Pipedrive", mentionRate: 0, averageRank: null, isBrand: true }],
	topDomains: [],
	trend: [],
};

export const answers: AnswerView[] = [
	{
		id: "x1",
		engine: "claude-cli",
		promptText: "What is the best CRM for small marketing agencies?",
		text: "**HubSpot** is the default. Pipedrive is cheaper <img src=x onerror=alert(1)>.",
		searched: true,
		durationMs: 25_000,
		errorCode: null,
		errorMessage: null,
		mentions: [
			{ entity: "HubSpot", rank: 1, firstIndex: 2, count: 1 },
			{ entity: "Pipedrive", rank: 2, firstIndex: 28, count: 1 },
		],
		brandRank: 2,
		brandCited: false,
		citations: [{ url: "https://attio.com/f/best-crm", domain: "attio.com", title: "Best CRM" }],
		sources: [{ url: "https://attio.com/f/best-crm", domain: "attio.com", title: "Best CRM" }],
	},
	{
		id: "x2",
		engine: "codex-cli",
		promptText: "What is the best CRM for small marketing agencies?",
		text: "",
		searched: false,
		durationMs: 0,
		errorCode: "cli_outdated",
		errorMessage: "Update the Codex CLI and try again.",
		mentions: [],
		brandRank: null,
		brandCited: false,
		citations: [],
		sources: [],
	},
];
