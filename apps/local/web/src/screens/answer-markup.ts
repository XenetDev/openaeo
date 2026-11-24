export type MarkupSource = { title: string; name: string; href: string };
type Citation = { url: string; domain: string; title?: string };

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const LIST = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;
const RULE = /^\s*([-*_])\1{2,}\s*$/;

const isHttp = (url: string) => /^https?:\/\//i.test(url);
const plain = (text: string) => text.replace(/\*\*/g, "").trim();

function domainOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

export function toAnswerMarkup(
	text: string,
	citations: Citation[],
	brand: string[],
): { answer: string; sources: MarkupSource[] } {
	const sources: MarkupSource[] = [];
	const index = new Map<string, number>();
	const cite = (url: string, title?: string) => {
		const known = index.get(url);
		if (known !== undefined) return known;
		sources.push({ title: title?.trim() || domainOf(url), name: domainOf(url), href: url });
		index.set(url, sources.length);
		return sources.length;
	};
	for (const c of citations) if (isHttp(c.url)) cite(c.url, c.title);

	let body = text
		.replace(/\r\n?/g, "\n")
		.replace(/\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/g, (_, label: string, url: string) =>
			isHttp(url) ? `${label} [${cite(url)}]` : label,
		);
	body = body.replace(
		/https?:\/\/[^\s)\]>"']+/gi,
		(url) => `[${cite(url.replace(/[.,;:!?]+$/, ""))}]${/[.,;:!?]+$/.exec(url)?.[0] ?? ""}`,
	);

	body = body.replace(/\*\*([^*\n]+)\*\*/g, (whole, inner: string) =>
		/\[\d+\]/.test(inner)
			? inner
					.split(/\s*(\[\d+\])\s*/)
					.filter(Boolean)
					.map((part) => (/^\[\d+\]$/.test(part) ? part : `**${part}**`))
					.join(" ")
			: whole,
	);

	const names = brand.map((n) => n.trim()).filter(Boolean);
	const brandPattern = names.length
		? new RegExp(
				`(?<![\\p{L}\\p{N}*])(?:${[...names]
					.sort((a, b) => b.length - a.length)
					.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
					.join("|")})(?![\\p{L}\\p{N}])`,
				"gu",
			)
		: null;
	const embolden = (line: string) =>
		brandPattern
			? line
					.split(/(\*\*[^*\n]+\*\*)/)
					.map((part) =>
						part.startsWith("**") && part.endsWith("**") && part.length > 4
							? part
							: part.replace(brandPattern, (hit) => `**${hit}**`),
					)
					.join("")
			: line;

	const lines = body.split("\n");
	const out: string[] = [];
	const paragraph = (value: string) => {
		if (out.length && out[out.length - 1] !== "") out.push("");
		out.push(value, "");
	};
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i] as string;
		if (!line.trim() || RULE.test(line) || /^[\s|]+$/.test(line)) {
			if (out.length && out[out.length - 1] !== "") out.push("");
			continue;
		}
		if (TABLE_ROW.test(line)) {
			const rows: string[][] = [];
			let headed = false;
			const start = i;
			while (i < lines.length && TABLE_ROW.test(lines[i] as string)) {
				const current = lines[i] as string;
				if (TABLE_RULE.test(current)) headed = headed || i === start + 1;
				else
					rows.push(
						current
							.trim()
							.replace(/^\|/, "")
							.replace(/\|$/, "")
							.split("|")
							.map((cell) => cell.trim()),
					);
				i += 1;
			}
			i -= 1;
			for (const row of headed ? rows.slice(1) : rows) {
				const [first, ...rest] = row;
				const cells = rest.filter(Boolean);
				if (!first && cells.length === 0) continue;
				out.push(`- **${plain(first ?? "")}**${cells.length ? `: ${cells.map(embolden).join(" · ")}` : ""}`);
			}
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading) {
			paragraph(`**${plain(heading[1] ?? "")}**`);
			continue;
		}
		const item = LIST.exec(line);
		out.push(item ? `- ${embolden((item[1] ?? "").trim())}` : embolden(line.trim()));
	}
	const spaced: string[] = [];
	for (const line of out) {
		const previous = spaced[spaced.length - 1];
		const isItem = line.startsWith("- ");
		if (previous !== undefined && previous !== "" && line !== "" && isItem !== previous.startsWith("- "))
			spaced.push("");
		spaced.push(line);
	}
	while (spaced.length && spaced[spaced.length - 1] === "") spaced.pop();
	let tail = spaced.length;
	while (tail > 0 && ((spaced[tail - 1] as string).startsWith("- ") || spaced[tail - 1] === "")) tail -= 1;
	if (
		tail > 0 &&
		tail < spaced.length &&
		/^(?:sources|references|citations|links)\s*:?$/i.test(plain(spaced[tail - 1] as string))
	)
		spaced.length = tail - 1;
	const answer = spaced
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	return { answer, sources };
}
