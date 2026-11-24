import { Database } from "bun:sqlite";

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
];

export function openDb(path: string): Database {
	const db = new Database(path, { create: true });
	db.exec("PRAGMA foreign_keys = ON");
	if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
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
