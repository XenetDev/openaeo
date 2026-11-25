import type { AuditResult, Finding } from "@openaeo/engine";
import { ENGINE_LABELS } from "./engine-catalog";
import type { Report } from "./report";

const percent = (value: number) => `${Math.round(value * 100)}%`;
const pad = (value: string, width: number) => value.padEnd(width);

export function formatReport(name: string, report: Report): string {
	const m = report.overall.metrics;
	const tone = report.overall.sentiment;
	const lines = [
		`OpenAEO · ${name}`,
		"",
		`${pad("Visibility", 18)}${report.overall.visibility} / 100`,
		`${pad("Mentioned in", 18)}${percent(m.mentionRate)} of ${m.answers} answers`,
		`${pad("Own site cited in", 18)}${percent(m.citationRate)} of answers`,
		`${pad("Average position", 18)}${m.averageRank === null ? "not mentioned" : m.averageRank.toFixed(1)}`,
		...(tone.score === null
			? []
			: [
					`${pad("Sentiment", 18)}${tone.score} / 100 (${tone.positive} positive, ${tone.neutral} neutral, ${tone.negative} negative)`,
				]),
		"",
		`${pad("Engine", 20)}${pad("Visibility", 12)}${pad("Mentioned", 11)}${pad("Cited", 8)}Errors`,
		...report.engines.map(
			(e) =>
				`${pad(ENGINE_LABELS[e.engine] ?? e.engine, 20)}${pad(String(e.visibility), 12)}${pad(percent(e.metrics.mentionRate), 11)}${pad(percent(e.metrics.citationRate), 8)}${e.errors}`,
		),
		"",
		`${pad("Who gets mentioned", 26)}${pad("Share of answers", 18)}Average position`,
		...report.competitors.map(
			(c) =>
				`${pad(c.isBrand ? `${c.name} (you)` : c.name, 26)}${pad(percent(c.mentionRate), 18)}${c.averageRank === null ? "-" : c.averageRank.toFixed(1)}`,
		),
	];
	if (report.topDomains.length) {
		lines.push(
			"",
			"Most cited sites",
			...report.topDomains
				.slice(0, 8)
				.map((d) => `${pad(d.isBrand ? `${d.domain} (yours)` : d.domain, 40)}${d.citations}`),
		);
	}
	return lines.join("\n");
}

const SEVERITIES = ["high", "medium", "low"] as const;

export function formatAudit(result: Pick<AuditResult, "origin" | "score" | "pages" | "findings">): string {
	const read = result.pages.filter((p) => !p.error).length;
	const lines = [
		`OpenAEO audit · ${result.origin}`,
		"",
		`${pad("Score", 18)}${result.score} / 100`,
		`${pad("Pages read", 18)}${read} of ${result.pages.length}`,
		`${pad("Findings", 18)}${result.findings.length}`,
	];
	for (const severity of SEVERITIES) {
		const groups = new Map<string, Finding[]>();
		for (const finding of result.findings.filter((f) => f.severity === severity))
			groups.set(finding.title, [...(groups.get(finding.title) ?? []), finding]);
		if (groups.size === 0) continue;
		lines.push("", severity.toUpperCase());
		for (const [title, findings] of groups) {
			const first = findings[0] as Finding;
			lines.push(
				`  ${title}${findings.length > 1 ? ` (${findings.length} pages)` : ""}`,
				`    ${first.url}`,
				...first.fix.split("\n").map((line, i) => `    ${i === 0 ? "Fix: " : "     "}${line}`),
			);
		}
	}
	if (result.findings.length === 0) lines.push("", "No problems found.");
	const unread = result.pages.filter((p) => p.error);
	if (unread.length) lines.push("", "Could not read", ...unread.slice(0, 10).map((p) => `  ${p.url}  ${p.error}`));
	return lines.join("\n");
}
