import type { ReactNode } from "react";
import { isHttp } from "./format";

type Marker = (text: string, key: string) => ReactNode[];

const INLINE = /\*\*([^*\n]+?)\*\*|`([^`\n]+?)`|\[([^\]\n]+?)\]\(([^)\s]+)\)/g;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const RULE = /^\s*([-*_])\1{2,}\s*$/;

function makeMarker(brand: string[], others: string[]): Marker {
	const names = [...brand, ...others].map((n) => n.trim()).filter(Boolean);
	if (names.length === 0) return (text) => [text];
	const escaped = [...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`, "giu");
	const brandKeys = new Set(brand.map((n) => n.trim().toLowerCase()));
	return (text, key) => {
		const parts: ReactNode[] = [];
		let cursor = 0;
		for (const hit of text.matchAll(pattern)) {
			if (hit.index > cursor) parts.push(text.slice(cursor, hit.index));
			parts.push(
				<mark key={`${key}-m${hit.index}`} className="oa-mark" data-brand={brandKeys.has(hit[0].toLowerCase()) ? "true" : "false"}>
					{hit[0]}
				</mark>,
			);
			cursor = hit.index + hit[0].length;
		}
		if (cursor < text.length) parts.push(text.slice(cursor));
		return parts;
	};
}

function inline(text: string, mark: Marker, key: string): ReactNode[] {
	const parts: ReactNode[] = [];
	let cursor = 0;
	for (const hit of text.matchAll(INLINE)) {
		const at = hit.index;
		if (at > cursor) parts.push(...mark(text.slice(cursor, at), `${key}-t${cursor}`));
		const [, bold, code, label, url] = hit;
		if (bold !== undefined) parts.push(<strong key={`${key}-b${at}`}>{mark(bold, `${key}-b${at}`)}</strong>);
		else if (code !== undefined) parts.push(<code key={`${key}-c${at}`}>{code}</code>);
		else if (label !== undefined && url !== undefined) {
			parts.push(
				isHttp(url) ? (
					<a key={`${key}-a${at}`} href={url} target="_blank" rel="noreferrer noopener">
						{label}
					</a>
				) : (
					label
				),
			);
		}
		cursor = at + hit[0].length;
	}
	if (cursor < text.length) parts.push(...mark(text.slice(cursor), `${key}-t${cursor}`));
	return parts;
}

const cells = (line: string) =>
	line
		.trim()
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((cell) => cell.trim());

export function AnswerText({ text, brand, others }: { text: string; brand: string[]; others: string[] }) {
	const mark = makeMarker(brand, others);
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	const blocks: ReactNode[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i] as string;
		const key = `l${i}`;
		if (!line.trim() || RULE.test(line)) {
			i += 1;
			continue;
		}
		if (TABLE_ROW.test(line)) {
			const rows: string[][] = [];
			let headed = false;
			const start = i;
			while (i < lines.length && TABLE_ROW.test(lines[i] as string)) {
				const current = lines[i] as string;
				if (TABLE_RULE.test(current)) headed = headed || i === start + 1;
				else rows.push(cells(current));
				i += 1;
			}
			const head = headed ? rows[0] : undefined;
			const body = headed ? rows.slice(1) : rows;
			blocks.push(
				<div key={key} className="oa-answer-table">
					<table>
						{head ? (
							<thead>
								<tr>
									{head.map((cell, c) => (
										<th key={`${key}-h${c}`}>{inline(cell, mark, `${key}-h${c}`)}</th>
									))}
								</tr>
							</thead>
						) : null}
						<tbody>
							{body.map((row, r) => (
								<tr key={`${key}-r${r}`}>
									{row.map((cell, c) => (
										<td key={`${key}-r${r}c${c}`}>{inline(cell, mark, `${key}-r${r}c${c}`)}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>,
			);
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading) {
			blocks.push(
				<h3 key={key} className="oa-answer-h">
					{inline(heading[1] ?? "", mark, key)}
				</h3>,
			);
			i += 1;
			continue;
		}
		const listPattern = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : null;
		if (listPattern) {
			const items: ReactNode[] = [];
			while (i < lines.length) {
				const item = listPattern.exec(lines[i] as string);
				if (!item) break;
				items.push(<li key={`l${i}`}>{inline(item[1] ?? "", mark, `l${i}`)}</li>);
				i += 1;
			}
			blocks.push(listPattern === BULLET ? <ul key={key}>{items}</ul> : <ol key={key}>{items}</ol>);
			continue;
		}
		const paragraph: string[] = [];
		while (i < lines.length) {
			const current = lines[i] as string;
			if (!current.trim() || TABLE_ROW.test(current) || HEADING.test(current) || BULLET.test(current) || NUMBERED.test(current) || RULE.test(current)) break;
			paragraph.push(current.trim());
			i += 1;
		}
		blocks.push(<p key={key}>{inline(paragraph.join(" "), mark, key)}</p>);
	}

	return <div className="oa-answer-text">{blocks}</div>;
}
