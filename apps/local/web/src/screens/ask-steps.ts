const TOPICS: [RegExp, string][] = [
	[
		/\b(mcp|skills?|agents?|connect\w*|install\w*|set ?up|api keys?|invite\w*|settings?|export\w*)\b/,
		"Looking up how OpenAEO works",
	],
	[/\b(credits?|billing|subscription|upgrade|invoice|pricing|workspace)\b/, "Checking your workspace"],
	[/\b(competitors?|rivals?|compet\w+)\b/, "Checking the competitors you track"],
	[/\b(posts?|linkedin|facebook|publish\w*|drafts?)\b/, "Checking your posts"],
	[
		/\b(schedul\w*|every (day|week|month)|daily|weekly|monthly|prompts?|questions?|run)\b/,
		"Checking your prompts and schedule",
	],
	[/\b(audit\w*|fix\w*|website|site|schema|robots|llms\.txt|pages?)\b/, "Reading your site audit"],
	[/\b(sources?|sites|cit\w+|links?|mentioned on)\b/, "Reading the sites AI cites"],
	[/\b(plan|next|steps?|to ?do|priorit\w+|start)\b/, "Reading your plan"],
];

export function thinkingSteps(question: string, engine: string): [string, string] {
	const asked = question.toLowerCase();
	const first = TOPICS.find(([words]) => words.test(asked))?.[1] ?? "Reading your latest answers";
	return [first, engine ? `Writing the answer with ${engine}` : "Writing the answer"];
}
