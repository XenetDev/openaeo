export type PageId = "overview" | "prompts" | "answers" | "sources" | "competitors" | "audit" | "runs" | "ask" | "settings";

export type EngineInfo = { id: string; label: string; available: boolean; reason: string | null; enabled: boolean };
export type EntityView = { name: string; aliases: string[]; domains: string[] };
export type ProjectView = EntityView & { id: string };
export type PromptView = { id: string; text: string; active: boolean };
export type RunView = { id: string; status: "running" | "done" | "interrupted"; startedAt: number; finishedAt: number | null; total: number; completed: number };
export type MetricsView = { answers: number; mentionRate: number; averageRank: number | null; rankScore: number; shareOfVoice: number; citationRate: number };
export type SourceView = { url: string; domain: string; title?: string };

export type ReportView = {
	run: RunView | null;
	overall: { metrics: MetricsView; visibility: number };
	engines: { engine: string; metrics: MetricsView; visibility: number; errors: number }[];
	competitors: { name: string; mentionRate: number; averageRank: number | null; isBrand: boolean }[];
	topDomains: { domain: string; citations: number; isBrand: boolean }[];
	trend: { runId: string; startedAt: number; visibility: number; mentionRate: number }[];
	problems?: { engine: string; message: string; count: number }[];
};

export type AnswerView = {
	id: string;
	engine: string;
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
	sentiment?: "positive" | "neutral" | "negative" | null;
	createdAt?: number;
	model?: string | null;
	inputTokens?: number | null;
	outputTokens?: number | null;
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
	own?: boolean;
};
export type FindingView = { checkId: string; severity: "high" | "medium" | "low"; url: string; title: string; evidence: string; fix: string };
export type ArtefactsView = { robotsTxt?: string; llmsTxt?: string; organizationJsonLd?: string };
