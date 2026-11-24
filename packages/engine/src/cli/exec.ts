import { spawn } from "node:child_process";

export type ExecResult = { code: number | null; stdout: string; stderr: string; durationMs: number; timedOut: boolean };

export type ExecOptions = { cwd: string; stdin?: string; timeoutMs: number; signal?: AbortSignal };

export type Exec = (cmd: string, args: string[], o: ExecOptions) => Promise<ExecResult>;

export const runCommand: Exec = (cmd, args, o) =>
	new Promise((resolve, reject) => {
		const started = Date.now();
		const child = spawn(cmd, args, { cwd: o.cwd, stdio: ["pipe", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		let timedOut = false;

		const kill = () => child.kill("SIGKILL");
		const timer = setTimeout(() => {
			timedOut = true;
			kill();
		}, o.timeoutMs);
		const finish = () => {
			clearTimeout(timer);
			o.signal?.removeEventListener("abort", kill);
		};

		if (o.signal?.aborted) kill();
		else o.signal?.addEventListener("abort", kill, { once: true });

		child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
			stderr += chunk;
		});
		child.stdin.on("error", () => {});
		child.on("error", (error) => {
			finish();
			reject(error);
		});
		child.on("close", (code) => {
			finish();
			resolve({ code, stdout, stderr, durationMs: Date.now() - started, timedOut });
		});
		child.stdin.end(o.stdin ?? "");
	});
