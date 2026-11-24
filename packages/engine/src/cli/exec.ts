import { spawn } from "node:child_process";

export type ExecResult = { code: number | null; stdout: string; stderr: string; durationMs: number; timedOut: boolean };

export type ExecOptions = { cwd: string; stdin?: string; timeoutMs: number; signal?: AbortSignal };

export type Exec = (cmd: string, args: string[], o: ExecOptions) => Promise<ExecResult>;

export const runCommand: Exec = (cmd, args, o) =>
	new Promise((resolve, reject) => {
		const started = Date.now();
		const child = spawn(cmd, args, { cwd: o.cwd, stdio: ["pipe", "pipe", "pipe"], detached: true });
		let stdout = "";
		let stderr = "";
		let settled = false;

		const killTree = () => {
			try {
				if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
			} catch {
				child.kill("SIGKILL");
			}
		};
		const settle = (code: number | null, timedOut: boolean) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			o.signal?.removeEventListener("abort", onAbort);
			resolve({ code, stdout, stderr, durationMs: Date.now() - started, timedOut });
		};
		const onAbort = () => {
			killTree();
			settle(null, false);
		};
		const timer = setTimeout(() => {
			killTree();
			settle(null, true);
		}, o.timeoutMs);

		child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
			if (!settled) stdout += chunk;
		});
		child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
			if (!settled) stderr += chunk;
		});
		child.stdin.on("error", () => {});
		child.on("error", (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			o.signal?.removeEventListener("abort", onAbort);
			reject(error);
		});
		child.on("close", (code) => settle(code, false));

		if (o.signal?.aborted) onAbort();
		else o.signal?.addEventListener("abort", onAbort, { once: true });
		child.stdin.end(o.stdin ?? "");
	});
