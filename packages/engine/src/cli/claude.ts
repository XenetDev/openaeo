import { parseClaudeStream } from "../providers/claude-parse";
import type { Provider } from "../types";
import { cliProvider } from "./adapter";
import { type Exec, runCommand } from "./exec";

export type CliOptions = { bin?: string; model?: string; exec?: Exec };

const ARGS = [
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

export function createClaudeCli(o: CliOptions = {}): Provider {
	return cliProvider({
		id: "claude-cli",
		label: "Claude Code",
		bin: o.bin ?? "claude",
		exec: o.exec ?? runCommand,
		args: () => (o.model ? [...ARGS, "--model", o.model] : ARGS),
		stdin: (prompt) => prompt,
		parse: parseClaudeStream,
	});
}
