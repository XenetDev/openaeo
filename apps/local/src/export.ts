import type { Store } from "./store/types";

type Cell = string | number | null;

const FORMULA = /^[=+\-@\t\r]/;

function cell(value: Cell): string {
	if (value === null) return "";
	if (typeof value === "number") return String(value);
	const safe = FORMULA.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: Cell[][]): string {
	return rows.map((row) => `${row.map(cell).join(",")}\r\n`).join("");
}

const HEADER = [
	"run_started",
	"engine",
	"model",
	"question",
	"tags",
	"mentioned",
	"position",
	"own_site_cited",
	"sentiment",
	"brands_named",
	"cited_sites",
	"error",
	"answer",
];

export async function answersCsv(store: Store, projectId: string, runId?: string): Promise<string> {
	const run = (runId ? await store.runs.get(runId) : await store.runs.latest(projectId)) ?? null;
	if (!run || run.projectId !== projectId) return toCsv([HEADER]);
	const prompts = new Map((await store.prompts.list(projectId)).map((prompt) => [prompt.id, prompt]));
	const started = new Date(run.startedAt).toISOString();
	const rows = (await store.answers.listByRun(run.id)).map((answer): Cell[] => {
		const prompt = prompts.get(answer.promptId);
		const failed = answer.errorCode !== null;
		return [
			started,
			answer.engine,
			answer.model,
			prompt?.text ?? "(deleted question)",
			(prompt?.tags ?? []).join("; "),
			failed ? null : answer.brandRank === null ? "no" : "yes",
			answer.brandRank,
			failed ? null : answer.brandCited ? "yes" : "no",
			answer.sentiment,
			[...answer.mentions]
				.sort((a, b) => a.rank - b.rank)
				.map((mention) => mention.entity)
				.join("; "),
			[...new Set(answer.citations.map((citation) => citation.domain))].join("; "),
			answer.errorMessage ?? answer.errorCode,
			answer.text,
		];
	});
	return toCsv([HEADER, ...rows]);
}
