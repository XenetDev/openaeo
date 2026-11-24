export type PageId =
	| "overview"
	| "prompts"
	| "answers"
	| "sources"
	| "competitors"
	| "opportunities"
	| "audit"
	| "runs"
	| "ask"
	| "settings";

export type EngineView = {
	id: string;
	label: string;
	available: boolean;
	reason: string | null;
	enabled: boolean;
	api: { name: string; defaultModel: string } | null;
};
export type EntityView = { name: string; aliases: string[]; domains: string[] };
export type ProjectView = EntityView & { id: string };
export type PromptView = { id: string; text: string; active: boolean; tags: string[] };
export type RunView = {
	id: string;
	status: "running" | "done" | "interrupted";
	startedAt: number;
	finishedAt: number | null;
	total: number;
	completed: number;
};
export type MetricsView = {
	answers: number;
	mentionRate: number;
	averageRank: number | null;
	rankScore: number;
	shareOfVoice: number;
	citationRate: number;
};
export type SourceView = { url: string; domain: string; title?: string };

export type SentimentView = { score: number | null; positive: number; neutral: number; negative: number };

export type ReportView = {
	run: RunView | null;
	overall: { metrics: MetricsView; visibility: number; sentiment: SentimentView };
	engines: { engine: string; metrics: MetricsView; visibility: number; sentiment: SentimentView; errors: number }[];
	competitors: { name: string; mentionRate: number; averageRank: number | null; isBrand: boolean }[];
	topDomains: { domain: string; citations: number; isBrand: boolean }[];
	trend: { runId: string; startedAt: number; visibility: number; mentionRate: number; sentiment: number | null }[];
	problems: { engine: string; message: string; count: number }[];
};

export type AnswerView = {
	id: string;
	engine: string;
	promptId: string;
	promptText: string;
	text: string;
	searched: boolean;
	durationMs: number;
	errorCode: string | null;
	errorMessage: string | null;
	mentions: { entity: string; rank: number; firstIndex: number; count: number }[];
	brandRank: number | null;
	brandCited: boolean;
	citations: SourceView[];
	sources: SourceView[];
	sentiment: "positive" | "neutral" | "negative" | null;
	createdAt: number;
	model: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
};

export type NewProject = EntityView & { competitors: EntityView[]; prompts: string[] };

export type Suggestions = { prompts: string[]; fallback: boolean };

export type AuditView = {
	id: string;
	origin: string;
	status: "running" | "done" | "interrupted";
	startedAt: number;
	finishedAt: number | null;
	score: number | null;
	pages: { url: string; status: number; words: number; error?: string }[];
	skipped: number;
	own: boolean;
};
export type FindingView = {
	checkId: string;
	severity: "high" | "medium" | "low";
	url: string;
	title: string;
	evidence: string;
	fix: string;
};
export type ArtefactsView = { robotsTxt?: string; llmsTxt?: string; organizationJsonLd?: string };

export type OpportunitiesView = {
	runId: string | null;
	missed: { question: string; engines: string[]; named: string[] }[];
	sites: { domain: string; citations: number; questions: number }[];
	fixes: { title: string; severity: string; pages: number }[];
};

export type PromptStatView = {
	promptId: string;
	text: string;
	active: boolean;
	history: { runId: string; startedAt: number; rate: number }[];
	latest: number | null;
	previous: number | null;
	bestRank: number | null;
};

export type CompetitorIdea = { name: string; domain: string | null };

export type AskTurn = { role: "user" | "assistant"; text: string };
export type AskAction =
	| { type: "run" }
	| { type: "audit" }
	| { type: "track"; question: string }
	| { type: "open"; page: string };

export type Ok = { ok: true };
export type StateResponse = { projects: ProjectView[]; engines: EngineView[] };
export type ProjectDetail = { project: ProjectView; competitors: EntityView[]; prompts: PromptView[] };
export type RunDetail = { run: RunView; answers: AnswerView[] };
export type LatestAudit = { audit: AuditView | null; findings: FindingView[]; artefacts: ArtefactsView };
export type AskReply = { text: string; engine: string; actions: AskAction[] };
export type SettingsResponse = { settings: Record<string, string> };
