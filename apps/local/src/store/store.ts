import type { Database } from "bun:sqlite";
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

export type EntityInput = { name: string; aliases: string[]; domains: string[] };
export type Project = EntityInput & { id: string; createdAt: number };
export type Competitor = EntityInput & { id: string; projectId: string };
export type Prompt = { id: string; projectId: string; text: string; active: boolean; createdAt: number };
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

type AuditRow = {
	id: string;
	project_id: string;
	origin: string;
	status: AuditStatus;
	started_at: number;
	finished_at: number | null;
	score: number | null;
	pages: string;
	skipped: number;
	own: number;
};
type FindingRow = {
	check_id: string;
	severity: Finding["severity"];
	url: string;
	title: string;
	evidence: string;
	fix: string;
};

type EntityRow = { id: string; name: string; aliases: string; domains: string };
type ProjectRow = EntityRow & { created_at: number };
type CompetitorRow = EntityRow & { project_id: string };
type PromptRow = { id: string; project_id: string; text: string; active: number; created_at: number };
type RunRow = {
	id: string;
	project_id: string;
	status: RunStatus;
	started_at: number;
	finished_at: number | null;
	total: number;
	completed: number;
};
type AnswerRow = {
	id: string;
	run_id: string;
	prompt_id: string;
	engine: EngineId;
	model: string | null;
	text: string;
	searched: number;
	duration_ms: number;
	input_tokens: number | null;
	output_tokens: number | null;
	searches: number | null;
	error_code: ProviderErrorCode | null;
	error_message: string | null;
	brand_rank: number | null;
	brand_cited: number;
	brand_sourced: number;
	mentions: string;
	citations: string;
	sources: string;
	created_at: number;
	sentiment: StoredAnswer["sentiment"];
};

function pidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return typeof error === "object" && error !== null && "code" in error && error.code === "EPERM";
	}
}

const clean = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];
const list = (json: string): string[] => JSON.parse(json) as string[];

const toProject = (r: ProjectRow): Project => ({
	id: r.id,
	name: r.name,
	aliases: list(r.aliases),
	domains: list(r.domains),
	createdAt: r.created_at,
});
const toCompetitor = (r: CompetitorRow): Competitor => ({
	id: r.id,
	projectId: r.project_id,
	name: r.name,
	aliases: list(r.aliases),
	domains: list(r.domains),
});
const toPrompt = (r: PromptRow): Prompt => ({
	id: r.id,
	projectId: r.project_id,
	text: r.text,
	active: r.active === 1,
	createdAt: r.created_at,
});
const toRun = (r: RunRow): Run => ({
	id: r.id,
	projectId: r.project_id,
	status: r.status,
	startedAt: r.started_at,
	finishedAt: r.finished_at,
	total: r.total,
	completed: r.completed,
});
const toAnswer = (r: AnswerRow): StoredAnswer => ({
	id: r.id,
	runId: r.run_id,
	promptId: r.prompt_id,
	engine: r.engine,
	model: r.model,
	text: r.text,
	searched: r.searched === 1,
	durationMs: r.duration_ms,
	inputTokens: r.input_tokens,
	outputTokens: r.output_tokens,
	searches: r.searches,
	errorCode: r.error_code,
	errorMessage: r.error_message,
	createdAt: r.created_at,
	mentions: JSON.parse(r.mentions) as Mention[],
	brandRank: r.brand_rank,
	brandCited: r.brand_cited === 1,
	brandSourced: r.brand_sourced === 1,
	citations: JSON.parse(r.citations) as Source[],
	sources: JSON.parse(r.sources) as Source[],
	sentiment: r.sentiment,
});

const toAudit = (r: AuditRow): StoredAudit => ({
	id: r.id,
	projectId: r.project_id,
	origin: r.origin,
	status: r.status,
	startedAt: r.started_at,
	finishedAt: r.finished_at,
	score: r.score,
	pages: JSON.parse(r.pages) as AuditPage[],
	skipped: r.skipped,
	own: r.own === 1,
});

export function createStore(db: Database) {
	const projects = {
		list: (): Project[] =>
			db.query<ProjectRow, []>("SELECT * FROM project ORDER BY created_at, rowid").all().map(toProject),
		get(id: string): Project | null {
			const row = db.query<ProjectRow, [string]>("SELECT * FROM project WHERE id = ?").get(id);
			return row ? toProject(row) : null;
		},
		create(input: EntityInput): Project {
			const name = input.name.trim();
			if (!name) throw new Error("A project needs a name.");
			const project: Project = {
				id: crypto.randomUUID(),
				name,
				aliases: clean(input.aliases),
				domains: clean(input.domains),
				createdAt: Date.now(),
			};
			db.query("INSERT INTO project (id, name, aliases, domains, created_at) VALUES (?, ?, ?, ?, ?)").run(
				project.id,
				project.name,
				JSON.stringify(project.aliases),
				JSON.stringify(project.domains),
				project.createdAt,
			);
			return project;
		},
		update(id: string, input: EntityInput): Project | null {
			const name = input.name.trim();
			if (!name) throw new Error("A project needs a name.");
			db.query("UPDATE project SET name = ?, aliases = ?, domains = ? WHERE id = ?").run(
				name,
				JSON.stringify(clean(input.aliases)),
				JSON.stringify(clean(input.domains)),
				id,
			);
			return projects.get(id);
		},
		remove(id: string): void {
			db.query("DELETE FROM project WHERE id = ?").run(id);
		},
	};

	const competitors = {
		list: (projectId: string): Competitor[] =>
			db
				.query<CompetitorRow, [string]>("SELECT * FROM competitor WHERE project_id = ? ORDER BY position")
				.all(projectId)
				.map(toCompetitor),
		replace(projectId: string, inputs: EntityInput[]): Competitor[] {
			db.transaction(() => {
				db.query("DELETE FROM competitor WHERE project_id = ?").run(projectId);
				const seen = new Set<string>();
				let position = 0;
				for (const input of inputs) {
					const name = input.name.trim();
					if (!name || seen.has(name.toLowerCase())) continue;
					seen.add(name.toLowerCase());
					db.query(
						"INSERT INTO competitor (id, project_id, name, aliases, domains, position) VALUES (?, ?, ?, ?, ?, ?)",
					).run(
						crypto.randomUUID(),
						projectId,
						name,
						JSON.stringify(clean(input.aliases)),
						JSON.stringify(clean(input.domains)),
						position,
					);
					position += 1;
				}
			})();
			return competitors.list(projectId);
		},
	};

	const prompts = {
		list: (projectId: string): Prompt[] =>
			db
				.query<PromptRow, [string]>("SELECT * FROM prompt WHERE project_id = ? ORDER BY created_at, rowid")
				.all(projectId)
				.map(toPrompt),
		get(id: string): Prompt | null {
			const row = db.query<PromptRow, [string]>("SELECT * FROM prompt WHERE id = ?").get(id);
			return row ? toPrompt(row) : null;
		},
		add(projectId: string, texts: string[]): Prompt[] {
			const added: Prompt[] = [];
			db.transaction(() => {
				for (const raw of texts) {
					const text = raw.trim();
					if (!text) continue;
					const prompt: Prompt = { id: crypto.randomUUID(), projectId, text, active: true, createdAt: Date.now() };
					const result = db
						.query(
							"INSERT OR IGNORE INTO prompt (id, project_id, text, text_key, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
						)
						.run(prompt.id, projectId, text, text.toLowerCase(), prompt.createdAt);
					if (result.changes > 0) added.push(prompt);
				}
			})();
			return added;
		},
		setActive(id: string, active: boolean): void {
			db.query("UPDATE prompt SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
		},
		remove(id: string): void {
			db.query("DELETE FROM prompt WHERE id = ?").run(id);
		},
	};

	const runs = {
		get(id: string): Run | null {
			const row = db.query<RunRow, [string]>("SELECT * FROM run WHERE id = ?").get(id);
			return row ? toRun(row) : null;
		},
		create(projectId: string, total: number): Run {
			const id = crypto.randomUUID();
			db.query(
				"INSERT INTO run (id, project_id, status, started_at, total, owner_pid) VALUES (?, ?, 'running', ?, ?, ?)",
			).run(id, projectId, Date.now(), total, process.pid);
			return runs.get(id) as Run;
		},
		list: (projectId: string, limit: number): Run[] =>
			db
				.query<RunRow, [string, number]>(
					"SELECT * FROM run WHERE project_id = ? ORDER BY started_at DESC, rowid DESC LIMIT ?",
				)
				.all(projectId, limit)
				.map(toRun),
		latest: (projectId: string): Run | null => runs.list(projectId, 1)[0] ?? null,
		active(projectId: string): Run | null {
			const row = db
				.query<RunRow, [string]>("SELECT * FROM run WHERE project_id = ? AND status = 'running' LIMIT 1")
				.get(projectId);
			return row ? toRun(row) : null;
		},
		increment(id: string): void {
			db.query("UPDATE run SET completed = completed + 1 WHERE id = ?").run(id);
		},
		finish(id: string, status: RunStatus): Run | null {
			db.query("UPDATE run SET status = ?, finished_at = ? WHERE id = ?").run(status, Date.now(), id);
			return runs.get(id);
		},
		interruptOwn: (): number =>
			db
				.query("UPDATE run SET status = 'interrupted', finished_at = ? WHERE status = 'running' AND owner_pid = ?")
				.run(Date.now(), process.pid).changes,
		interruptStale(isAlive: (pid: number) => boolean = pidAlive): number {
			const running = db
				.query<{ id: string; owner_pid: number | null }, []>("SELECT id, owner_pid FROM run WHERE status = 'running'")
				.all();
			let count = 0;
			for (const row of running) {
				if (row.owner_pid !== null && isAlive(row.owner_pid)) continue;
				count += db
					.query("UPDATE run SET status = 'interrupted', finished_at = ? WHERE id = ? AND status = 'running'")
					.run(Date.now(), row.id).changes;
			}
			return count;
		},
	};

	const answers = {
		save(runId: string, promptId: string, item: RunItem, match: MatchResult | null): StoredAnswer {
			const run = runs.get(runId);
			if (!run) throw new Error("Run not found.");
			const id = crypto.randomUUID();
			const answer = item.ok ? item.answer : null;
			db.query(
				`INSERT INTO answer (id, run_id, project_id, prompt_id, engine, model, text, searched, duration_ms, input_tokens, output_tokens, searches,
					error_code, error_message, brand_rank, brand_cited, brand_sourced, mentions, citations, sources, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				id,
				runId,
				run.projectId,
				promptId,
				item.engine,
				answer?.model ?? null,
				answer?.text ?? "",
				answer?.searched ? 1 : 0,
				answer?.durationMs ?? 0,
				answer?.usage?.inputTokens ?? null,
				answer?.usage?.outputTokens ?? null,
				answer?.usage?.searches ?? null,
				item.ok ? null : item.error.code,
				item.ok ? null : item.error.message,
				match?.brandRank ?? null,
				match?.brandCited ? 1 : 0,
				match?.brandSourced ? 1 : 0,
				JSON.stringify(match?.mentions ?? []),
				JSON.stringify(answer?.citations ?? []),
				JSON.stringify(answer?.sources ?? []),
				Date.now(),
			);
			return toAnswer(db.query<AnswerRow, [string]>("SELECT * FROM answer WHERE id = ?").get(id) as AnswerRow);
		},
		setSentiment(id: string, sentiment: NonNullable<StoredAnswer["sentiment"]>): void {
			db.query("UPDATE answer SET sentiment = ? WHERE id = ?").run(sentiment, id);
		},
		listByRun: (runId: string): StoredAnswer[] =>
			db
				.query<AnswerRow, [string]>("SELECT * FROM answer WHERE run_id = ? ORDER BY created_at, rowid")
				.all(runId)
				.map(toAnswer),
	};

	const settings = {
		get(key: string): string | null {
			return db.query<{ value: string }, [string]>("SELECT value FROM setting WHERE key = ?").get(key)?.value ?? null;
		},
		set(key: string, value: string): void {
			db.query(
				"INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
			).run(key, value);
		},
		remove(key: string): void {
			db.query("DELETE FROM setting WHERE key = ?").run(key);
		},
		all: (): Record<string, string> =>
			Object.fromEntries(
				db
					.query<{ key: string; value: string }, []>("SELECT key, value FROM setting")
					.all()
					.map((r) => [r.key, r.value]),
			),
	};

	const interruptOwnIn = (table: "run" | "audit") =>
		db
			.query(`UPDATE ${table} SET status = 'interrupted', finished_at = ? WHERE status = 'running' AND owner_pid = ?`)
			.run(Date.now(), process.pid).changes;

	const audits = {
		interruptOwn: (): number => interruptOwnIn("audit"),
		get(id: string): StoredAudit | null {
			const row = db.query<AuditRow, [string]>("SELECT * FROM audit WHERE id = ?").get(id);
			return row ? toAudit(row) : null;
		},
		create(projectId: string, origin: string, own = true): StoredAudit {
			const id = crypto.randomUUID();
			db.query(
				"INSERT INTO audit (id, project_id, origin, status, started_at, owner_pid, own) VALUES (?, ?, ?, 'running', ?, ?, ?)",
			).run(id, projectId, origin, Date.now(), process.pid, own ? 1 : 0);
			return audits.get(id) as StoredAudit;
		},
		latest(projectId: string, o: { ownOnly?: boolean } = {}): StoredAudit | null {
			const row = db
				.query<AuditRow, [string]>(
					`SELECT * FROM audit WHERE project_id = ? ${o.ownOnly ? "AND own = 1" : ""} ORDER BY started_at DESC, rowid DESC LIMIT 1`,
				)
				.get(projectId);
			return row ? toAudit(row) : null;
		},
		active(projectId: string): StoredAudit | null {
			const row = db
				.query<AuditRow, [string]>("SELECT * FROM audit WHERE project_id = ? AND status = 'running' LIMIT 1")
				.get(projectId);
			return row ? toAudit(row) : null;
		},
		finish(id: string, status: AuditStatus, result: AuditResult | null): StoredAudit | null {
			db.transaction(() => {
				db.query(
					"UPDATE audit SET origin = COALESCE(?, origin), status = ?, finished_at = ?, score = ?, pages = ?, skipped = ? WHERE id = ?",
				).run(
					result?.origin ?? null,
					status,
					Date.now(),
					result?.score ?? null,
					JSON.stringify(result?.pages ?? []),
					result?.skipped.length ?? 0,
					id,
				);
				let position = 0;
				for (const finding of result?.findings ?? []) {
					db.query(
						"INSERT INTO finding (id, audit_id, position, check_id, severity, url, title, evidence, fix) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
					).run(
						crypto.randomUUID(),
						id,
						position,
						finding.checkId,
						finding.severity,
						finding.url,
						finding.title,
						finding.evidence,
						finding.fix,
					);
					position += 1;
				}
			})();
			return audits.get(id);
		},
		findings: (auditId: string): Finding[] =>
			db
				.query<FindingRow, [string]>(
					"SELECT check_id, severity, url, title, evidence, fix FROM finding WHERE audit_id = ? ORDER BY position",
				)
				.all(auditId)
				.map((r) => ({
					checkId: r.check_id,
					severity: r.severity,
					url: r.url,
					title: r.title,
					evidence: r.evidence,
					fix: r.fix,
				})),
		interruptStale(isAlive: (pid: number) => boolean = pidAlive): number {
			const running = db
				.query<{ id: string; owner_pid: number | null }, []>("SELECT id, owner_pid FROM audit WHERE status = 'running'")
				.all();
			let count = 0;
			for (const row of running) {
				if (row.owner_pid !== null && isAlive(row.owner_pid)) continue;
				count += db
					.query("UPDATE audit SET status = 'interrupted', finished_at = ? WHERE id = ? AND status = 'running'")
					.run(Date.now(), row.id).changes;
			}
			return count;
		},
	};

	return { projects, competitors, prompts, runs, answers, settings, audits };
}

export type Store = ReturnType<typeof createStore>;
