import type { Fetched } from "./fetch";
import type { PageModel } from "./page";
import { parseRobots, robotsAllows } from "./robots";

export type Severity = "high" | "medium" | "low";
export type Finding = { checkId: string; severity: Severity; url: string; title: string; evidence: string; fix: string };

export const AI_CRAWLERS: { id: string; operator: string; purpose: "training" | "search" | "user" }[] = [
	{ id: "GPTBot", operator: "OpenAI", purpose: "training" },
	{ id: "OAI-SearchBot", operator: "OpenAI", purpose: "search" },
	{ id: "ChatGPT-User", operator: "OpenAI", purpose: "user" },
	{ id: "ClaudeBot", operator: "Anthropic", purpose: "training" },
	{ id: "Claude-SearchBot", operator: "Anthropic", purpose: "search" },
	{ id: "Claude-User", operator: "Anthropic", purpose: "user" },
	{ id: "PerplexityBot", operator: "Perplexity", purpose: "search" },
	{ id: "Perplexity-User", operator: "Perplexity", purpose: "user" },
	{ id: "Google-Extended", operator: "Google", purpose: "training" },
	{ id: "CCBot", operator: "Common Crawl", purpose: "training" },
];

const PURPOSE: Record<string, string> = {
	training: "collects pages to train models",
	search: "builds the index its AI search answers from",
	user: "fetches a page when a person asks the assistant about it",
};

const STALE_MS = 18 * 30 * 24 * 60 * 60 * 1000;
const QUESTION = /\?\s*$|^(what|how|why|which|who|when|where|can|does|do|is|are|should|will)\b/i;

export const quote = (text: string, max = 200) => {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
const looksLikeHtml = (f: Fetched) => /html/i.test(f.contentType) || /^\s*<(!doctype|html)/i.test(f.text);
const present = (f: Fetched | null): boolean => f !== null && f.status >= 200 && f.status < 300 && !looksLikeHtml(f);

export function checkSite(input: { origin: string; robots: Fetched | null; llms: Fetched | null }): Finding[] {
	const findings: Finding[] = [];
	const robotsUrl = `${input.origin}/robots.txt`;
	if (input.robots && present(input.robots)) {
		const robots = parseRobots(input.robots.text);
		for (const crawler of AI_CRAWLERS) {
			if (robotsAllows(robots, crawler.id, "/")) continue;
			findings.push({
				checkId: "crawler-blocked",
				severity: crawler.purpose === "training" ? "medium" : "high",
				url: robotsUrl,
				title: `robots.txt blocks ${crawler.id} (${crawler.operator})`,
				evidence: `${crawler.id} ${PURPOSE[crawler.purpose]}. Your robots.txt does not let it read the site.`,
				fix: `Add this group to robots.txt, above any "User-agent: *" group:\nUser-agent: ${crawler.id}\nAllow: /`,
			});
		}
	} else {
		findings.push({
			checkId: "robots-missing",
			severity: "low",
			url: robotsUrl,
			title: "No robots.txt file",
			evidence: input.robots ? `The address returned status ${input.robots.status}${looksLikeHtml(input.robots) ? " with a web page, not a robots file" : ""}.` : "The file could not be fetched.",
			fix: "Add a robots.txt that allows the AI crawlers you want and points to your sitemap.",
		});
	}
	if (!present(input.llms)) {
		findings.push({
			checkId: "llms-txt-missing",
			severity: "low",
			url: `${input.origin}/llms.txt`,
			title: "No llms.txt file",
			evidence: "llms.txt is a proposed plain-text summary of a site for AI tools. Whether engines use it is disputed.",
			fix: "Optionally add /llms.txt with a short description of the business and links to its most important pages.",
		});
	}
	return findings;
}

export function checkPage(page: PageModel, now: number = Date.now()): Finding[] {
	const findings: Finding[] = [];
	const add = (checkId: string, severity: Severity, title: string, evidence: string, fix: string) =>
		findings.push({ checkId, severity, url: page.url, title, evidence: quote(evidence), fix });

	if (page.words < 50 && page.scripts > 0 && !page.h1) {
		add(
			"js-only-content",
			"high",
			"The page has almost no content without JavaScript",
			`Only ${page.words} words are present in the HTML the server sends. Most AI crawlers do not run JavaScript, so they see an empty page.`,
			"Render the page's main content on the server (server-side rendering or static generation) so it is in the initial HTML.",
		);
		return findings;
	}

	if (!page.title || !page.description) {
		add(
			"missing-title-or-description",
			"medium",
			!page.title ? "The page has no title" : "The page has no meta description",
			!page.title ? "No <title> element was found." : "No meta description was found.",
			"Add a specific <title> and a one or two sentence meta description that says what the page answers.",
		);
	}

	if (page.schemaErrors > 0) {
		add("invalid-structured-data", "medium", "Structured data on the page is not valid JSON", `${page.schemaErrors} JSON-LD block(s) could not be parsed.`, "Fix the JSON-LD so it parses; validate it with a schema testing tool.");
	} else if (!page.hasSchema) {
		add("no-structured-data", "medium", "The page has no structured data", "No JSON-LD was found.", "Add JSON-LD describing the page: Article for articles, Product for products, FAQPage for question-and-answer content.");
	}

	if (page.isHome && page.hasSchema && !page.schemaTypes.some((t) => t === "Organization" || t === "LocalBusiness" || t === "Corporation")) {
		add("no-organization-schema", "medium", "The home page does not describe the organisation", `Schema types found: ${page.schemaTypes.join(", ") || "none"}.`, "Add Organization JSON-LD to the home page with name, url, logo and sameAs links to official profiles.");
	} else if (page.isHome && !page.hasSchema && page.schemaErrors === 0) {
		add("no-organization-schema", "medium", "The home page does not describe the organisation", "No Organization structured data was found.", "Add Organization JSON-LD to the home page with name, url, logo and sameAs links to official profiles.");
	}

	if (!page.h1) {
		add("no-h1", "medium", "The page has no main heading", "No <h1> element was found.", "Add one <h1> that states the question or topic the page answers.");
	} else {
		const first = page.headings.find((h) => h.level === 1)?.following ?? "";
		const size = wordCount(first);
		if (size < 20 || size > 80) {
			add(
				"no-direct-answer",
				"medium",
				"No short, direct answer after the main heading",
				size === 0 ? `Heading: "${page.h1}". No paragraph follows it.` : `The first paragraph after the heading is ${size} words: "${first}"`,
				"Open with a 30 to 60 word paragraph that answers the heading's question outright. Engines lift this passage.",
			);
		}
	}

	const sub = page.headings.filter((h) => h.level === 2 || h.level === 3);
	const questions = sub.filter((h) => QUESTION.test(h.text));
	const long = page.words > 300;
	if (long && sub.length > 0 && questions.length === 0) {
		add("no-question-headings", "low", "No headings are phrased as questions", `Headings include: ${sub.slice(0, 3).map((h) => `"${h.text}"`).join(", ")}`, "Rephrase some H2/H3 headings as the questions people ask, each followed by a direct answer.");
	}
	if (questions.length >= 2 && !page.schemaTypes.includes("FAQPage") && page.schemaErrors === 0) {
		add("faq-without-schema", "medium", "Question-and-answer content has no FAQPage markup", `${questions.length} question headings, for example "${questions[0]?.text ?? ""}"`, "Add FAQPage JSON-LD whose questions and answers match the visible text.");
	}

	if (long && !page.author) {
		add("no-author", "low", "No author is named", "No author was found in the structured data, meta tags or byline.", "Name the author with a visible byline and in the Article JSON-LD, with credentials where relevant.");
	}

	const dated = page.dateModified ?? page.datePublished;
	if (long && !dated) {
		add("no-date", "low", "No published or updated date", "No date was found in the structured data, meta tags or a <time> element.", "Show a visible \"last updated\" date and set dateModified in the Article JSON-LD.");
	} else if (dated) {
		const time = Date.parse(dated);
		if (Number.isFinite(time) && now - time > STALE_MS) {
			add("stale-content", "low", "The page has not been updated in over 18 months", `Last dated ${dated.slice(0, 10)}.`, "Review the page, update anything out of date, and change the visible date and dateModified.");
		}
	}

	if (long && page.externalLinks === 0) {
		add("no-outbound-citations", "low", "The page cites no outside sources", "No links to other websites were found in the content.", "Link to the credible sources behind your claims: studies, documentation, original data.");
	}

	return findings;
}
