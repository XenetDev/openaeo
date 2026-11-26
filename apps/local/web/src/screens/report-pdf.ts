export type Inline = { text: string; bold: boolean };
export type Block = { kind: "paragraph"; parts: Inline[] } | { kind: "list"; items: Inline[][] };

/** Splits the output of `toAnswerMarkup` into paragraphs and lists, with bold runs. */
export function markupBlocks(markup: string): Block[] {
	const blocks: Block[] = [];
	let paragraph: string[] = [];
	const flush = () => {
		if (paragraph.length) blocks.push({ kind: "paragraph", parts: inline(paragraph.join(" ")) });
		paragraph = [];
	};
	for (const raw of markup.split("\n")) {
		const line = raw.trim();
		if (!line) flush();
		else if (line.startsWith("- ")) {
			flush();
			const last = blocks.at(-1);
			const item = inline(line.slice(2));
			if (last?.kind === "list") last.items.push(item);
			else blocks.push({ kind: "list", items: [item] });
		} else paragraph.push(line);
	}
	flush();
	return blocks;
}

function inline(text: string): Inline[] {
	return text
		.split(/(\*\*[^*]+\*\*)/)
		.filter(Boolean)
		.map((part) =>
			part.length > 4 && part.startsWith("**") && part.endsWith("**")
				? { text: part.slice(2, -2), bold: true }
				: { text: part, bold: false },
		);
}

type AnswerLike = {
	engine: string;
	promptId: string;
	promptText: string;
	errorCode: string | null;
	brandRank: number | null;
};

export type QuestionGroup<T extends AnswerLike> = {
	question: string;
	tags: string[];
	answers: T[];
	named: number;
	answered: number;
};

/** Groups answers by question, in the order the questions first appear, with answers in engine order. */
export function groupByQuestion<T extends AnswerLike>(
	answers: T[],
	engineOrder: string[],
	tagsOf: Map<string, string[]> = new Map(),
): QuestionGroup<T>[] {
	const groups = new Map<string, QuestionGroup<T>>();
	for (const answer of answers) {
		const key = answer.promptId || answer.promptText;
		let group = groups.get(key);
		if (!group) {
			group = {
				question: answer.promptText,
				tags: tagsOf.get(answer.promptId) ?? [],
				answers: [],
				named: 0,
				answered: 0,
			};
			groups.set(key, group);
		}
		group.answers.push(answer);
		if (answer.errorCode === null) {
			group.answered += 1;
			if (answer.brandRank !== null) group.named += 1;
		}
	}
	const rank = (engine: string) => {
		const index = engineOrder.indexOf(engine);
		return index === -1 ? engineOrder.length : index;
	};
	for (const group of groups.values()) group.answers.sort((a, b) => rank(a.engine) - rank(b.engine));
	return [...groups.values()];
}

/** The engines that answered, in the order they first appear. */
export function enginesIn(answers: { engine: string }[]): string[] {
	return [...new Set(answers.map((answer) => answer.engine))];
}

const slug = (name: string) =>
	name
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase() || "openaeo";

/** The suggested file name. Browsers name a printed PDF after the document title. */
export function reportFileName(brand: string, startedAt: number | null, tag = ""): string {
	const date = startedAt === null ? "" : `-${new Date(startedAt).toISOString().slice(0, 10)}`;
	return `${slug(brand)}-ai-visibility${tag ? `-${slug(tag)}` : ""}${date}`;
}
