import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import * as engine from "../src/index";

const src = resolve(import.meta.dir, "../src");

function reachable(entry: string): string[] {
	const seen = new Set<string>();
	const queue = [entry];
	while (queue.length) {
		const file = queue.pop() as string;
		if (seen.has(file)) continue;
		seen.add(file);
		const code = readFileSync(file, "utf8");
		for (const found of code.matchAll(/from\s+"(\.[^"]+)"/g)) {
			const base = resolve(dirname(file), found[1] as string);
			const target = [`${base}.ts`, join(base, "index.ts")].find((candidate) => existsSync(candidate));
			if (target) queue.push(target);
		}
	}
	return [...seen];
}

test("the pure entry point never reaches subprocess code", () => {
	const files = reachable(join(src, "index.ts"));
	expect(files.length).toBeGreaterThan(5);
	for (const file of files) {
		expect(relative(src, file).startsWith("cli")).toBe(false);
		const code = readFileSync(file, "utf8");
		expect(code).not.toMatch(/node:child_process|node:fs|bun:|\bBun\./);
	}
});

test("the pure entry point exports the public API", () => {
	for (const name of ["AnswerSchema", "ProviderError", "normalizeUrl", "extractUrls", "toDomain", "sameSite", "parseClaudeStream", "parseCodexStream", "createOpenAI", "match", "metrics", "run"]) {
		expect(typeof (engine as Record<string, unknown>)[name]).not.toBe("undefined");
	}
});
