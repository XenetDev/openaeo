import { Database } from "bun:sqlite";
import { chmodSync } from "node:fs";

const MIGRATIONS = [
	`
	CREATE TABLE project (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		aliases TEXT NOT NULL,
		domains TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);
	CREATE TABLE competitor (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		aliases TEXT NOT NULL,
		domains TEXT NOT NULL,
		position INTEGER NOT NULL
	);
	CREATE TABLE prompt (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
		text TEXT NOT NULL,
		text_key TEXT NOT NULL,
		active INTEGER NOT NULL DEFAULT 1,
		created_at INTEGER NOT NULL,
		UNIQUE (project_id, text_key)
	);
	CREATE TABLE run (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
		status TEXT NOT NULL,
		started_at INTEGER NOT NULL,
		finished_at INTEGER,
		total INTEGER NOT NULL,
		completed INTEGER NOT NULL DEFAULT 0
	);
	CREATE INDEX run_project ON run(project_id, started_at);
	CREATE TABLE answer (
		id TEXT PRIMARY KEY,
		run_id TEXT NOT NULL REFERENCES run(id) ON DELETE CASCADE,
		project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
		prompt_id TEXT NOT NULL,
		engine TEXT NOT NULL,
		model TEXT,
		text TEXT NOT NULL,
		searched INTEGER NOT NULL,
		duration_ms INTEGER NOT NULL,
		input_tokens INTEGER,
		output_tokens INTEGER,
		searches INTEGER,
		error_code TEXT,
		error_message TEXT,
		brand_rank INTEGER,
		brand_cited INTEGER NOT NULL,
		brand_sourced INTEGER NOT NULL,
		mentions TEXT NOT NULL,
		citations TEXT NOT NULL,
		sources TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX answer_run ON answer(run_id);
	CREATE INDEX answer_project ON answer(project_id, created_at);
	CREATE TABLE setting (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	`,
	"ALTER TABLE answer ADD COLUMN sentiment TEXT;",
	"ALTER TABLE run ADD COLUMN owner_pid INTEGER;",
	`
	CREATE TABLE audit (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
		origin TEXT NOT NULL,
		status TEXT NOT NULL,
		started_at INTEGER NOT NULL,
		finished_at INTEGER,
		score INTEGER,
		pages TEXT NOT NULL DEFAULT '[]',
		skipped INTEGER NOT NULL DEFAULT 0,
		owner_pid INTEGER
	);
	CREATE INDEX audit_project ON audit(project_id, started_at);
	CREATE TABLE finding (
		id TEXT PRIMARY KEY,
		audit_id TEXT NOT NULL REFERENCES audit(id) ON DELETE CASCADE,
		position INTEGER NOT NULL,
		check_id TEXT NOT NULL,
		severity TEXT NOT NULL,
		url TEXT NOT NULL,
		title TEXT NOT NULL,
		evidence TEXT NOT NULL,
		fix TEXT NOT NULL
	);
	CREATE INDEX finding_audit ON finding(audit_id, position);
	`,
	"ALTER TABLE audit ADD COLUMN own INTEGER NOT NULL DEFAULT 1;",
	"ALTER TABLE prompt ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';",
	`
	CREATE TABLE brand_check (
		id TEXT PRIMARY KEY,
		run_id TEXT NOT NULL REFERENCES run(id) ON DELETE CASCADE,
		project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
		engine TEXT NOT NULL,
		text TEXT NOT NULL,
		knows TEXT,
		summary TEXT,
		confused_with TEXT NOT NULL,
		concerns TEXT NOT NULL,
		sources TEXT NOT NULL,
		own_site_used INTEGER NOT NULL,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX brand_check_run ON brand_check(run_id);
	`,
];

export function openDb(path: string): Database {
	const db = new Database(path, { create: true });
	db.exec("PRAGMA foreign_keys = ON");
	db.exec("PRAGMA busy_timeout = 5000");
	if (path !== ":memory:") {
		chmodSync(path, 0o600);
		db.exec("PRAGMA journal_mode = WAL");
	}
	const row = db.query<{ user_version: number }, []>("PRAGMA user_version").get();
	const current = row?.user_version ?? 0;
	for (let version = current; version < MIGRATIONS.length; version += 1) {
		db.transaction(() => {
			db.exec(MIGRATIONS[version] as string);
			db.exec(`PRAGMA user_version = ${version + 1}`);
		})();
	}
	return db;
}
