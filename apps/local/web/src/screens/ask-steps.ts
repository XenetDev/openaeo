export type AskFacts = {
	brand: string;
	answers: number;
	engines: string[];
	competitors: string[];
	prompts: number;
	audit: { score: number; pages: number; findings: number } | null;
	openSteps: number;
};

type Topic = "guide" | "workspace" | "competitors" | "posts" | "schedule" | "audit" | "sources" | "plan";

const TOPICS: [RegExp, Topic][] = [
	[/\b(mcp|skills?|agents?|connect\w*|install\w*|set ?up|api keys?|invite\w*|settings?|export\w*)\b/, "guide"],
	[/\b(credits?|billing|subscription|upgrade|invoice|pricing|workspace)\b/, "workspace"],
	[/\b(competitors?|rivals?|compet\w+|ahead of)\b/, "competitors"],
	[/\b(posts?|linkedin|facebook|publish\w*|drafts?)\b/, "posts"],
	[/\b(schedul\w*|every (day|week|month)|daily|weekly|monthly|prompts?|questions?|run)\b/, "schedule"],
	[/\b(audit\w*|fix\w*|website|site|schema|robots|llms\.txt|pages?)\b/, "audit"],
	[/\b(sources?|sites|cit\w+|links?|mentioned on)\b/, "sources"],
	[/\b(plan|next|steps?|to ?do|priorit\w+|start)\b/, "plan"],
];

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function list(names: string[]): string {
	if (names.length <= 1) return names[0] ?? "";
	if (names.length <= 3) return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
	return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/** What Aeo is given for this question, in the figures of this brand. Nothing here is made up. */
export function thinkingSteps(question: string, engine: string, facts: AskFacts): string[] {
	const asked = question.toLowerCase();
	const topic = TOPICS.find(([words]) => words.test(asked))?.[1];
	const read = facts.answers
		? `Reading ${count(facts.answers, "answer")}${facts.engines.length ? ` from ${list(facts.engines)}` : ""}`
		: "No finished run yet, reading your setup";
	const by: Record<Topic, (string | null)[]> = {
		guide: ["Reading the OpenAEO guide"],
		workspace: ["Checking your workspace"],
		competitors: [
			read,
			facts.competitors.length
				? `Comparing ${facts.brand} with ${list(facts.competitors)}`
				: "No competitors tracked yet",
		],
		posts: [read, "Checking your posts"],
		schedule: [`Checking your ${count(facts.prompts, "tracked question")}`, "Checking your run schedule"],
		audit: facts.audit
			? [
					`Reading your site audit: ${facts.audit.score} of 100 across ${count(facts.audit.pages, "page")}`,
					facts.audit.findings ? `Going through ${count(facts.audit.findings, "finding")}` : null,
				]
			: ["No site audit yet, reading your setup"],
		sources: [read, facts.answers ? "Going through the sites AI cited" : null],
		plan: [
			read,
			facts.openSteps
				? `Checking your plan: ${count(facts.openSteps, "step")} open`
				: "Checking your plan: every step is done",
		],
	};
	const first = topic ? by[topic] : [read, facts.answers ? `Checking where ${facts.brand} is named` : null];
	return [
		...first.filter((step): step is string => step !== null),
		engine ? `Writing the answer with ${engine}` : "Writing the answer",
	];
}
