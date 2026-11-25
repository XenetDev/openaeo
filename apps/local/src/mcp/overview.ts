import { formatReport } from "../format";
import { buildReport, type Report } from "../report";
import { ANSWER_NOTICE, isReply, type McpContext, oneLine, percent, projectArg, say, tagArg, when } from "./shared";

const TREND_RUNS = 8;
const KNOWS = {
	yes: "knows the brand",
	partly: "unsure about the brand",
	no: "does not know the brand",
	unclear: "not analysed",
} as const;

const fixed = (value: number) => value.toFixed(1);
const whole = (value: number) => `${Math.round(value)}`;

function moved(name: string, now: number, before: number, format: (value: number) => string): string {
	if (Math.abs(now - before) < 0.05) return `  ${name}: unchanged at ${format(now)}`;
	return `  ${name}: ${now > before ? "up" : "down"} to ${format(now)} from ${format(before)}`;
}

function trendLines(report: Report): string[] {
	const { trend, overall } = report;
	const previous = trend.at(-2);
	if (!previous) return [];
	const m = overall.metrics;
	const tone = overall.sentiment.score;
	return [
		"",
		"Recent runs, oldest first",
		...trend
			.slice(-TREND_RUNS)
			.map(
				(t) =>
					`  ${when(t.startedAt)} · visibility ${fixed(t.visibility)} · mentioned ${percent(t.mentionRate)} · own site cited ${percent(t.citationRate)} · position ${
						t.averageRank === null ? "-" : fixed(t.averageRank)
					}${t.sentiment === null ? "" : ` · sentiment ${whole(t.sentiment)}`}`,
			),
		"",
		`Since the previous run (${when(previous.startedAt)})`,
		moved("Visibility score", overall.visibility, previous.visibility, fixed),
		moved("Mentioned in", m.mentionRate * 100, previous.mentionRate * 100, (n) => `${whole(n)}%`),
		moved("Own site cited in", m.citationRate * 100, previous.citationRate * 100, (n) => `${whole(n)}%`),
		...(m.averageRank !== null && previous.averageRank !== null
			? [`${moved("Average position", m.averageRank, previous.averageRank, fixed)} (lower is better)`]
			: []),
		...(tone !== null && previous.sentiment !== null ? [moved("Sentiment", tone, previous.sentiment, whole)] : []),
	];
}

function brandLines(name: string, report: Report, label: (engine: string) => string): string[] {
	if (report.brand.length === 0) return [];
	const said = report.brand.flatMap((check) => {
		const engine = `> [${label(check.engine)}]`;
		return [
			...(check.summary ? [`${engine} says: ${oneLine(check.summary)}`] : []),
			`${engine} sources: ${oneLine(check.sources.slice(0, 8).join(", ")) || "none, it answered from its own memory"}`,
			...check.confusedWith.map((other) => `${engine} confused with: ${oneLine(other)}`),
			...check.concerns.map((concern) => `${engine} doubt: ${oneLine(concern)}`),
		];
	});
	return [
		"",
		`What AI says when asked about ${name}`,
		"Each engine was asked what the company is and does. This is separate from the tracked questions.",
		...report.brand.map(
			(check) =>
				`  ${label(check.engine)}: ${KNOWS[check.knows ?? "unclear"]} · own site ${check.ownSiteUsed ? "used" : "not used"}`,
		),
		ANSWER_NOTICE,
		...said,
	];
}

export function registerOverviewTools({ server, store, resolve, label }: McpContext): void {
	server.registerTool(
		"get_report",
		{
			description:
				"Get the AI visibility report for a brand: visibility score, sentiment, how often each AI engine mentions it, its position against competitors, the most cited websites, the trend across recent runs with what changed since the previous one, and what each engine says when asked about the brand directly, including the doubts it raised.",
			inputSchema: {
				...projectArg,
				tag: tagArg.optional().describe("Only count answers to questions with this tag."),
			},
			annotations: { readOnlyHint: true },
		},
		async ({ project, tag }) => {
			const found = await resolve(project);
			if (isReply(found)) return found;
			const report = await buildReport(store, found.id, { tag });
			if (!report.run) return say(`No runs yet for ${found.name}. Use run_prompts to start one.`);
			const lines: string[] = [];
			if (report.run.status === "running")
				lines.push(
					`A run is in progress (${report.run.completed} of ${report.run.total} answers so far). Results below are partial.`,
					"",
				);
			if (tag) lines.push(`Only questions tagged "${oneLine(tag)}" are counted.`, "");
			lines.push(formatReport(found.name, report, label));
			if (report.problems.length)
				lines.push("", "Problems in this run", ...report.problems.map((p) => `  ${label(p.engine)}: ${p.message}`));
			lines.push(...trendLines(report), ...brandLines(found.name, report, label));
			return say(lines.join("\n"));
		},
	);
}
