import { type HTMLElement, parse } from "node-html-parser";
import { sameSite, toDomain } from "../url";

export type Heading = { level: number; text: string; following: string };

export type PageModel = {
	url: string;
	isHome: boolean;
	title: string;
	description: string;
	h1: string | null;
	headings: Heading[];
	words: number;
	scripts: number;
	schemaTypes: string[];
	schemaErrors: number;
	hasSchema: boolean;
	author: string | null;
	datePublished: string | null;
	dateModified: string | null;
	externalLinks: number;
	internalLinks: string[];
};

const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const countWords = (text: string) => (clean(text) ? clean(text).split(" ").length : 0);

function walk(value: unknown, visit: (node: Record<string, unknown>) => void, depth = 0): void {
	if (depth > 8 || value === null || typeof value !== "object") return;
	if (Array.isArray(value)) {
		for (const item of value.slice(0, 200)) walk(item, visit, depth + 1);
		return;
	}
	const node = value as Record<string, unknown>;
	visit(node);
	for (const child of Object.values(node)) walk(child, visit, depth + 1);
}

function nameOf(value: unknown): string | null {
	if (typeof value === "string") return clean(value) || null;
	if (Array.isArray(value)) return nameOf(value[0]);
	if (value && typeof value === "object" && "name" in value) return nameOf((value as { name: unknown }).name);
	return null;
}

const attr = (root: HTMLElement, selector: string, name: string) => clean(root.querySelector(selector)?.getAttribute(name) ?? "");

export function parsePage(url: string, html: string): PageModel {
	let origin = "";
	let host = "";
	let isHome = false;
	try {
		const parsed = new URL(url);
		origin = parsed.origin;
		host = toDomain(url) ?? "";
		isHome = parsed.pathname === "/" || parsed.pathname === "";
	} catch {}

	const root = parse(html.slice(0, 3_000_000), { comment: false, blockTextElements: { script: true, style: true, noscript: true, pre: true } });

	const schemaTypes = new Set<string>();
	let schemaErrors = 0;
	let hasSchema = false;
	let author: string | null = null;
	let datePublished: string | null = null;
	let dateModified: string | null = null;
	for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
		const raw = script.text.trim();
		if (!raw) continue;
		try {
			const data: unknown = JSON.parse(raw);
			hasSchema = true;
			walk(data, (node) => {
				const type = node["@type"];
				for (const t of Array.isArray(type) ? type : [type]) if (typeof t === "string") schemaTypes.add(t);
				author ??= nameOf(node.author);
				if (typeof node.datePublished === "string") datePublished ??= node.datePublished;
				if (typeof node.dateModified === "string") dateModified ??= node.dateModified;
			});
		} catch {
			schemaErrors += 1;
		}
	}

	const scripts = root.querySelectorAll("script").length;
	const title = clean(root.querySelector("title")?.text ?? "");
	const description = attr(root, 'meta[name="description"]', "content") || attr(root, 'meta[property="og:description"]', "content");
	author ??= attr(root, 'meta[name="author"]', "content") || clean(root.querySelector('[rel="author"]')?.text ?? "") || null;
	datePublished ??= attr(root, 'meta[property="article:published_time"]', "content") || null;
	dateModified ??= attr(root, 'meta[property="article:modified_time"]', "content") || attr(root, "time[datetime]", "datetime") || null;

	for (const node of root.querySelectorAll("script, style, noscript, template, svg")) node.remove();
	const body = root.querySelector("body") ?? root;

	const headings: Heading[] = [];
	for (const node of body.querySelectorAll("h1, h2, h3, h4, h5, h6, p")) {
		const tag = node.tagName?.toLowerCase() ?? "";
		const text = clean(node.text);
		if (tag === "p") {
			const last = headings.at(-1);
			if (last && !last.following && text) last.following = text;
		} else if (text) {
			headings.push({ level: Number(tag.slice(1)), text, following: "" });
		}
	}

	let externalLinks = 0;
	const internal = new Set<string>();
	for (const link of body.querySelectorAll("a[href]").slice(0, 2000)) {
		const href = link.getAttribute("href") ?? "";
		let target: URL;
		try {
			target = new URL(href, url);
		} catch {
			continue;
		}
		if (target.protocol !== "http:" && target.protocol !== "https:") continue;
		target.hash = "";
		if (target.origin === origin) internal.add(target.toString());
		else if (host && !sameSite(toDomain(target.toString()) ?? "", host)) externalLinks += 1;
	}

	return {
		url,
		isHome,
		title,
		description,
		h1: headings.find((h) => h.level === 1)?.text ?? null,
		headings,
		words: countWords(body.text),
		scripts,
		schemaTypes: [...schemaTypes],
		schemaErrors,
		hasSchema,
		author,
		datePublished,
		dateModified,
		externalLinks,
		internalLinks: [...internal],
	};
}
