import type { Provider } from "@openaeo/engine";

export type SuggestContext = { brand: string; domains: string[]; competitors: string[] };

const MAX = 12;

function clean(values: unknown[]): string[] {
	const seen = new Set<string>();
	const list: string[] = [];
	for (const value of values) {
		if (typeof value !== "string") continue;
		const text = value
			.trim()
			.replace(/^["'“”*_\s]+|["'“”*_\s]+$/g, "")
			.trim();
		if (text.length < 5 || text.length > 300) continue;
		const key = text.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		list.push(text);
		if (list.length === MAX) break;
	}
	return list;
}

export function parsePromptList(text: string): string[] {
	const start = text.indexOf("[");
	const end = text.lastIndexOf("]");
	if (start !== -1 && end > start) {
		try {
			const parsed: unknown = JSON.parse(text.slice(start, end + 1));
			if (Array.isArray(parsed)) return clean(parsed);
		} catch {}
	}
	const lines = [...text.matchAll(/^\s*(?:\d+[.)]|[-*•])\s+(.+)$/gm)].map((hit) => hit[1]);
	return clean(lines);
}

export function fallbackPrompts(context: SuggestContext): string[] {
	const { brand, competitors } = context;
	return clean([
		`Is ${brand} worth it?`,
		`What do people say about ${brand}?`,
		`What are the best alternatives to ${brand}?`,
		`Who is ${brand} best suited for?`,
		...competitors.slice(0, 3).flatMap((c) => [`${brand} vs ${c}: which is better?`, `What are the best alternatives to ${c}?`]),
	]);
}

export async function suggestPrompts(provider: Provider | null, context: SuggestContext): Promise<{ prompts: string[]; fallback: boolean }> {
	if (provider) {
		const request = [
			`A company called "${context.brand}"${context.domains[0] ? ` (website: ${context.domains[0]})` : ""} wants to know how AI assistants talk about it.`,
			context.competitors.length ? `Its competitors include: ${context.competitors.join(", ")}.` : "",
			"Write 10 questions a potential buyer would ask an AI assistant when looking for this kind of product or service, before they have chosen a vendor.",
			"Most questions should NOT name the company; they should describe the need. Include one or two that compare it with a competitor.",
			"Reply with only a JSON array of 10 strings.",
		]
			.filter(Boolean)
			.join("\n");
		try {
			const answer = await provider.ask(request, { timeoutMs: 120_000 });
			const prompts = parsePromptList(answer.text);
			if (prompts.length >= 1) return { prompts, fallback: false };
		} catch {}
	}
	return { prompts: fallbackPrompts(context), fallback: true };
}
