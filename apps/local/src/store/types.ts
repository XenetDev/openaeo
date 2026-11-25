import type {
	AuditPage,
	AuditResult,
	EngineId,
	Finding,
	MatchResult,
	Mention,
	ProviderErrorCode,
	RunItem,
	Source,
} from "@openaeo/engine";
import type { BrandCheck } from "../brand-check";

export type EntityInput = { name: string; aliases: string[]; domains: string[] };
export type ProjectInput = EntityInput & { location?: string };
export type Project = EntityInput & { id: string; location: string; createdAt: number };
export type Competitor = EntityInput & { id: string; projectId: string };
export type Prompt = {
	id: string;
	projectId: string;
	text: string;
	active: boolean;
	tags: string[];
	createdAt: number;
};
export type RunStatus = "running" | "done" | "interrupted";
export type Run = {
	id: string;
	projectId: string;
	status: RunStatus;
	startedAt: number;
	finishedAt: number | null;
	total: number;
	completed: number;
};
export type StoredAnswer = {
	id: string;
	runId: string;
	promptId: string;
	engine: EngineId;
	model: string | null;
	text: string;
	searched: boolean;
	durationMs: number;
	inputTokens: number | null;
	outputTokens: number | null;
	searches: number | null;
	errorCode: ProviderErrorCode | null;
	errorMessage: string | null;
	createdAt: number;
	mentions: Mention[];
	brandRank: number | null;
	brandCited: boolean;
	brandSourced: boolean;
	citations: Source[];
	sources: Source[];
	sentiment: "positive" | "neutral" | "negative" | null;
};

export type AuditStatus = "running" | "done" | "interrupted";
export type StoredAudit = {
	id: string;
	projectId: string;
	origin: string;
	status: AuditStatus;
	startedAt: number;
	finishedAt: number | null;
	score: number | null;
	pages: AuditPage[];
	skipped: number;
	own: boolean;
};

export type Awaitable<T> = T | Promise<T>;

export interface Store {
	projects: {
		list(): Awaitable<Project[]>;
		get(id: string): Awaitable<Project | null>;
		create(input: ProjectInput): Awaitable<Project>;
		update(id: string, input: ProjectInput): Awaitable<Project | null>;
		remove(id: string): Awaitable<void>;
	};
	competitors: {
		list(projectId: string): Awaitable<Competitor[]>;
		replace(projectId: string, inputs: EntityInput[]): Awaitable<Competitor[]>;
	};
	prompts: {
		list(projectId: string): Awaitable<Prompt[]>;
		get(id: string): Awaitable<Prompt | null>;
		add(projectId: string, texts: string[]): Awaitable<Prompt[]>;
		setActive(id: string, active: boolean): Awaitable<void>;
		setTags(id: string, tags: string[]): Awaitable<void>;
		remove(id: string): Awaitable<void>;
	};
	runs: {
		get(id: string): Awaitable<Run | null>;
		create(projectId: string, total: number): Awaitable<Run>;
		list(projectId: string, limit: number): Awaitable<Run[]>;
		latest(projectId: string): Awaitable<Run | null>;
		active(projectId: string): Awaitable<Run | null>;
		increment(id: string): Awaitable<void>;
		finish(id: string, status: RunStatus): Awaitable<Run | null>;
	};
	answers: {
		save(runId: string, promptId: string, item: RunItem, match: MatchResult | null): Awaitable<StoredAnswer>;
		setSentiment(id: string, sentiment: NonNullable<StoredAnswer["sentiment"]>): Awaitable<void>;
		listByRun(runId: string): Awaitable<StoredAnswer[]>;
	};
	settings: {
		get(key: string): Awaitable<string | null>;
		set(key: string, value: string): Awaitable<void>;
		remove(key: string): Awaitable<void>;
		all(): Awaitable<Record<string, string>>;
	};
	audits: {
		get(id: string): Awaitable<StoredAudit | null>;
		create(projectId: string, origin: string, own?: boolean): Awaitable<StoredAudit>;
		latest(projectId: string, o?: { ownOnly?: boolean }): Awaitable<StoredAudit | null>;
		active(projectId: string): Awaitable<StoredAudit | null>;
		finish(id: string, status: AuditStatus, result: AuditResult | null): Awaitable<StoredAudit | null>;
		findings(auditId: string): Awaitable<Finding[]>;
	};
	brandChecks: {
		save(runId: string, projectId: string, checks: BrandCheck[]): Awaitable<void>;
		listByRun(runId: string): Awaitable<BrandCheck[]>;
	};
}
