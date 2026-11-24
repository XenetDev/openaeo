export type TreeRun = { id: string; status: "running" | "done" | "interrupted"; startedAt: number; finishedAt: number | null; total: number; completed: number };
export type TreeAnswer = {
	id: string;
	engine: string;
	promptText: string;
	text: string;
	searched: boolean;
	durationMs: number;
	errorCode: string | null;
	errorMessage: string | null;
	createdAt?: number;
	model?: string | null;
	inputTokens?: number | null;
	outputTokens?: number | null;
};
export type TreeSpan = {
	id: string;
	name: string;
	kind: "agent" | "subagent" | "llm";
	status: "running" | "done" | "failed";
	start: number;
	end?: number;
	detail?: string;
	model?: string;
	tokensIn?: number;
	tokensOut?: number;
	input?: string;
	output?: string;
	error?: string;
	children?: TreeSpan[];
};

export function runTree(run: TreeRun, answers: TreeAnswer[], label: (engine: string) => string): TreeSpan {
	const live = run.status === "running";
	const groups = new Map<string, TreeAnswer[]>();
	for (const answer of answers) groups.set(answer.engine, [...(groups.get(answer.engine) ?? []), answer]);
	const children = [...groups.entries()].map(([engine, list]): TreeSpan => {
		const calls = list.map((answer): TreeSpan => {
			const end = Math.max(0, (answer.createdAt ?? run.startedAt) - run.startedAt);
			return {
				id: answer.id,
				name: answer.promptText,
				kind: "llm",
				status: answer.errorCode === null ? "done" : "failed",
				start: Math.max(0, end - answer.durationMs),
				end,
				detail: answer.searched ? "searched the web" : undefined,
				model: answer.model ?? undefined,
				tokensIn: answer.inputTokens ?? undefined,
				tokensOut: answer.outputTokens ?? undefined,
				input: answer.promptText,
				output: answer.errorCode === null ? `${answer.text.slice(0, 400)}${answer.text.length > 400 ? "…" : ""}` : undefined,
				error: answer.errorCode === null ? undefined : (answer.errorMessage ?? "No reason was given."),
			};
		});
		return {
			id: engine,
			name: label(engine),
			kind: "subagent",
			status: live ? "running" : calls.every((c) => c.status === "failed") ? "failed" : "done",
			start: Math.min(...calls.map((c) => c.start)),
			end: live ? undefined : Math.max(...calls.map((c) => c.end ?? 0)),
			children: calls,
		};
	});
	return {
		id: run.id,
		name: "Run",
		kind: "agent",
		status: live ? "running" : "done",
		start: 0,
		end: live ? undefined : Math.max(0, (run.finishedAt ?? run.startedAt) - run.startedAt),
		input: `${run.completed} of ${run.total} answers`,
		children,
	};
}
