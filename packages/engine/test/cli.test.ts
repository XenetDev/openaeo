import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClaudeCli, createCodexCli, type Exec, type ExecResult, runCommand } from "../src/cli/index";
import { ProviderError } from "../src/types";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "fixtures", name), "utf8");

type Call = { cmd: string; args: string[]; cwd: string; stdin?: string; timeoutMs: number; cwdWasEmptyTemp: boolean };

function fake(result: Partial<ExecResult> | Error) {
	const calls: Call[] = [];
	const exec: Exec = async (cmd, args, o) => {
		const cwdWasEmptyTemp =
			existsSync(o.cwd) && readdirSync(o.cwd).length === 0 && realpathSync(o.cwd).startsWith(realpathSync(tmpdir()));
		calls.push({ cmd, args, cwd: o.cwd, stdin: o.stdin, timeoutMs: o.timeoutMs, cwdWasEmptyTemp });
		if (result instanceof Error) throw result;
		return { code: 0, stdout: "", stderr: "", durationMs: 5, timedOut: false, ...result };
	};
	return { exec, calls };
}

async function codeOf(run: Promise<unknown>) {
	try {
		await run;
	} catch (error) {
		if (error instanceof ProviderError) return error;
		throw error;
	}
	throw new Error("expected a ProviderError");
}

const CLAUDE_ARGS = [
	"--print",
	"--tools",
	"WebSearch",
	"--allowedTools",
	"WebSearch",
	"--strict-mcp-config",
	"--setting-sources",
	"",
	"--no-session-persistence",
	"--output-format",
	"stream-json",
	"--verbose",
];

test("claude adapter runs the isolated command and parses the answer", async () => {
	const { exec, calls } = fake({ stdout: fixture("claude-search.jsonl"), durationMs: 1234 });
	const answer = await createClaudeCli({ exec }).ask("best crm?");
	expect(calls.length).toBe(1);
	expect(calls[0]?.cmd).toBe("claude");
	expect(calls[0]?.args).toEqual(CLAUDE_ARGS);
	expect(calls[0]?.stdin).toBe("best crm?");
	expect(calls[0]?.cwdWasEmptyTemp).toBe(true);
	expect(calls[0]?.timeoutMs).toBe(180_000);
	expect(answer.engine).toBe("claude-cli");
	expect(answer.durationMs).toBe(1234);
	expect(existsSync(calls[0]?.cwd ?? "")).toBe(false);
});

test("claude adapter passes a model, binary and timeout when given", async () => {
	const { exec, calls } = fake({ stdout: fixture("claude-no-search.jsonl") });
	await createClaudeCli({ exec, bin: "/opt/claude", model: "claude-sonnet-5-5" }).ask("q", { timeoutMs: 9000 });
	expect(calls[0]?.cmd).toBe("/opt/claude");
	expect(calls[0]?.args).toEqual([...CLAUDE_ARGS, "--model", "claude-sonnet-5-5"]);
	expect(calls[0]?.timeoutMs).toBe(9000);
});

test("codex adapter puts --search before exec and the prompt last", async () => {
	const { exec, calls } = fake({ stdout: fixture("codex-search.jsonl") });
	const answer = await createCodexCli({ exec }).ask("best crm?");
	expect(calls[0]?.cmd).toBe("codex");
	expect(calls[0]?.args).toEqual(["--search", "exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--json", "best crm?"]);
	expect(calls[0]?.cwdWasEmptyTemp).toBe(true);
	expect(answer.engine).toBe("codex-cli");
});

test("codex adapter passes a model after exec", async () => {
	const { exec, calls } = fake({ stdout: fixture("codex-search.jsonl") });
	await createCodexCli({ exec, model: "gpt-x" }).ask("q");
	expect(calls[0]?.args).toEqual(["--search", "exec", "-m", "gpt-x", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--json", "q"]);
});

test("a prompt that looks like a flag is not parsed as one by codex", async () => {
	const { exec, calls } = fake({ stdout: fixture("codex-search.jsonl") });
	await createCodexCli({ exec }).ask("--help me choose a CRM");
	expect(calls[0]?.args.slice(-2)).toEqual(["--", "--help me choose a CRM"]);
});

test("a missing binary is reported as not_installed", async () => {
	const enoent = Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" });
	const claude = await codeOf(createClaudeCli({ exec: fake(enoent).exec }).ask("q"));
	expect(claude.code).toBe("not_installed");
	expect(claude.message).toContain("claude");
	const codex = await codeOf(createCodexCli({ exec: fake(enoent).exec, bin: "codex-x" }).ask("q"));
	expect(codex.code).toBe("not_installed");
	expect(codex.message).toContain("codex-x");
});

test("a timed out run is reported as timeout", async () => {
	expect((await codeOf(createClaudeCli({ exec: fake({ timedOut: true, code: null }).exec }).ask("q"))).code).toBe("timeout");
	expect((await codeOf(createCodexCli({ exec: fake({ timedOut: true, code: null }).exec }).ask("q"))).code).toBe("timeout");
});

test("a crash with no output includes the end of stderr", async () => {
	const error = await codeOf(createClaudeCli({ exec: fake({ code: 1, stderr: "boom: config is broken" }).exec }).ask("q"));
	expect(error.code).toBe("failed");
	expect(error.message).toContain("boom: config is broken");
});

test("the temp directory is removed when the run fails", async () => {
	const { exec, calls } = fake({ timedOut: true, code: null });
	await codeOf(createCodexCli({ exec }).ask("q"));
	expect(existsSync(calls[0]?.cwd ?? "")).toBe(false);
});

test("runCommand captures output and passes stdin", async () => {
	const result = await runCommand("sh", ["-c", "cat; echo err >&2"], { cwd: tmpdir(), stdin: "hello", timeoutMs: 5000 });
	expect(result.code).toBe(0);
	expect(result.stdout).toBe("hello");
	expect(result.stderr.trim()).toBe("err");
	expect(result.timedOut).toBe(false);
});

test("runCommand kills a command that exceeds its timeout", async () => {
	const started = Date.now();
	const result = await runCommand("sh", ["-c", "sleep 5"], { cwd: tmpdir(), timeoutMs: 100 });
	expect(result.timedOut).toBe(true);
	expect(Date.now() - started).toBeLessThan(2000);
});

test("runCommand stops when the signal aborts", async () => {
	const controller = new AbortController();
	setTimeout(() => controller.abort(), 50);
	const started = Date.now();
	const result = await runCommand("sh", ["-c", "sleep 5"], { cwd: tmpdir(), timeoutMs: 10_000, signal: controller.signal });
	expect(Date.now() - started).toBeLessThan(2000);
	expect(result.code).not.toBe(0);
});

test("runCommand rejects with ENOENT for a missing binary", async () => {
	expect(runCommand("definitely-not-a-binary", [], { cwd: tmpdir(), timeoutMs: 1000 })).rejects.toMatchObject({ code: "ENOENT" });
});
