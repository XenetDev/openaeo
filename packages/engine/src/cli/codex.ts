import { parseCodexStream } from "../providers/codex-parse";
import type { Provider } from "../types";
import { cliProvider } from "./adapter";
import type { CliOptions } from "./claude";
import { runCommand } from "./exec";

export function createCodexCli(o: CliOptions = {}): Provider {
	return cliProvider({
		id: "codex-cli",
		label: "Codex",
		bin: o.bin ?? "codex",
		exec: o.exec ?? runCommand,
		model: o.model,
		args: (prompt) => [
			"--search",
			"exec",
			...(o.model ? ["-m", o.model] : []),
			"--sandbox",
			"read-only",
			"--skip-git-repo-check",
			"--ephemeral",
			"--json",
			...(prompt.startsWith("-") ? ["--"] : []),
			prompt,
		],
		parse: parseCodexStream,
	});
}
