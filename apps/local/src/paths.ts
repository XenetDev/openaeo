import { chmodSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function dataDir(env: Record<string, string | undefined> = process.env): string {
	const dir = env.OPENAEO_HOME?.trim() || join(env.HOME?.trim() || homedir(), ".openaeo");
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	chmodSync(dir, 0o700);
	return dir;
}

export const dbPath = (dir: string) => join(dir, "openaeo.db");
