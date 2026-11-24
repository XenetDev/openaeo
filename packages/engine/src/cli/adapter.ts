import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Answer, type AskOptions, type EngineId, type Provider, ProviderError } from "../types";
import type { Exec } from "./exec";

export const DEFAULT_TIMEOUT_MS = 180_000;

type Spec = {
	id: EngineId;
	label: string;
	bin: string;
	exec: Exec;
	args: (prompt: string) => string[];
	stdin?: (prompt: string) => string;
	parse: (stdout: string, durationMs: number) => Answer;
};

function isMissingBinary(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export function cliProvider(spec: Spec): Provider {
	return {
		id: spec.id,
		async ask(prompt: string, opts: AskOptions = {}) {
			const cwd = await mkdtemp(join(tmpdir(), "openaeo-"));
			try {
				const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
				const result = await spec
					.exec(spec.bin, spec.args(prompt), { cwd, stdin: spec.stdin?.(prompt), timeoutMs, signal: opts.signal })
					.catch((error: unknown) => {
						if (isMissingBinary(error)) {
							throw new ProviderError(spec.id, "not_installed", `${spec.label} was not found (looked for \`${spec.bin}\`). Install it and try again.`);
						}
						throw new ProviderError(spec.id, "failed", `${spec.label} could not be started: ${error instanceof Error ? error.message : String(error)}`);
					});
				if (result.timedOut) {
					throw new ProviderError(spec.id, "timeout", `${spec.label} did not answer within ${Math.round(timeoutMs / 1000)} seconds.`);
				}
				try {
					return spec.parse(result.stdout, result.durationMs);
				} catch (error) {
					const stderr = result.stderr.trim();
					if (error instanceof ProviderError && error.code === "failed" && result.code !== 0 && stderr) {
						throw new ProviderError(spec.id, "failed", `${error.message} ${stderr.slice(-400)}`);
					}
					throw error;
				}
			} finally {
				await rm(cwd, { recursive: true, force: true });
			}
		},
	};
}
