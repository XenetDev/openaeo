import { checkPage, checkSite, type Finding, type Severity } from "./checks";
import { AuditFetchError, type Fetched } from "./fetch";
import { parsePage } from "./page";

export type AuditPage = { url: string; status: number; words: number; error?: string };

export type AuditResult = {
	origin: string;
	startedAt: number;
	pages: AuditPage[];
	findings: Finding[];
	score: number;
	skipped: string[];
};

export type RunAuditOptions = {
	url: string;
	get: (url: string) => Promise<Fetched>;
	maxPages?: number;
	concurrency?: number;
	signal?: AbortSignal;
	now?: () => number;
};

const WEIGHT: Record<Severity, number> = { high: 12, medium: 5, low: 2 };
const SITE_CHECKS = new Set([
	"crawler-blocked",
	"crawler-partly-blocked",
	"robots-error",
	"robots-missing",
	"llms-txt-missing",
	"site-unreachable",
]);
const NOT_A_PAGE = "This address is not a web page.";
const FETCH_MESSAGES: Record<string, string> = {
	bad_url: "That is not a web address.",
	blocked: "That address points to a private or internal network, which OpenAEO will not fetch.",
	too_large: "The page is larger than OpenAEO reads.",
	timeout: "The page took too long to load.",
	too_many_redirects: "The page redirected too many times.",
	network: "The page could not be reached.",
};
const ASSET = /\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|pdf|zip|gz|mp4|mp3|woff2?|ttf|xml|txt|md|json|rss|atom)$/i;

const messageOf = (error: unknown) =>
	error instanceof AuditFetchError
		? (FETCH_MESSAGES[error.code] ?? "The page could not be fetched.")
		: "The page could not be fetched.";
const ok = (f: Fetched) => f.status >= 200 && f.status < 300;
const isHtml = (f: Fetched) => /html/i.test(f.contentType) || (!f.contentType && /^\s*</.test(f.text));
const locs = (xml: string) =>
	[...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => (m[1] ?? "").replace(/&amp;/g, "&"));

export function scoreOf(findings: Finding[], pages: AuditPage[] = []): number {
	if (findings.some((f) => f.checkId === "site-unreachable")) return 0;
	const attempted = pages.filter((p) => p.error !== NOT_A_PAGE);
	const read = Math.max(1, attempted.filter((p) => !p.error).length);
	const unread = attempted.filter((p) => p.error).length;
	let penalty = attempted.length ? (40 * unread) / attempted.length : 0;
	const perCheck = new Map<string, { urls: Set<string>; weight: number }>();
	for (const finding of findings) {
		const weight = WEIGHT[finding.severity];
		if (SITE_CHECKS.has(finding.checkId)) {
			penalty += weight;
			continue;
		}
		const entry = perCheck.get(finding.checkId) ?? { urls: new Set<string>(), weight: 0 };
		entry.urls.add(finding.url);
		entry.weight = Math.max(entry.weight, weight);
		perCheck.set(finding.checkId, entry);
	}
	for (const [checkId, entry] of perCheck) {
		const share = Math.min(1, entry.urls.size / read);
		penalty += checkId === "js-only-content" ? 80 * share : entry.weight * 3 * share;
	}
	return Math.round(Math.max(0, Math.min(100, 100 - penalty)));
}

class HomeStatus extends Error {
	readonly status: number;

	constructor(status: number) {
		super("status");
		this.status = status;
	}
}

export async function runAudit(o: RunAuditOptions): Promise<AuditResult> {
	let origin: string;
	try {
		const parsed = new URL(o.url.includes("://") ? o.url : `https://${o.url}`);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("scheme");
		if (!parsed.hostname.includes(".") && !parsed.hostname.includes(":") && parsed.hostname !== "localhost")
			throw new Error("host");
		origin = parsed.origin;
	} catch {
		throw new Error("That is not a web address OpenAEO can audit.");
	}

	const startedAt = (o.now ?? Date.now)();
	const maxPages = Math.max(1, Math.floor(o.maxPages ?? 25));
	const concurrency = Math.max(1, Math.floor(o.concurrency ?? 4));
	const homeUrl = `${origin}/`;
	const tryGet = async (url: string) => {
		try {
			return await o.get(url);
		} catch {
			return null;
		}
	};

	let home: Fetched;
	try {
		home = await o.get(homeUrl);
		if (!ok(home)) throw new HomeStatus(home.status);
	} catch (error) {
		const reason =
			error instanceof HomeStatus ? `The home page answered with status ${error.status}.` : messageOf(error);
		const finding: Finding = {
			checkId: "site-unreachable",
			severity: "high",
			url: homeUrl,
			title: "The site could not be read",
			evidence: reason,
			fix: "Check the address, and that the site is public and not blocking automated requests.",
		};
		return {
			origin,
			startedAt,
			pages: [{ url: homeUrl, status: 0, words: 0, error: reason }],
			findings: [finding],
			score: 0,
			skipped: [],
		};
	}

	try {
		origin = new URL(home.url).origin;
	} catch {}
	const landing = home.url || homeUrl;

	const [robots, llms, sitemap] = await Promise.all([
		tryGet(`${origin}/robots.txt`),
		tryGet(`${origin}/llms.txt`),
		tryGet(`${origin}/sitemap.xml`),
	]);

	const homePage = { ...parsePage(landing, home.text), isHome: true };
	let discovered: string[] = [];
	if (sitemap && ok(sitemap) && /<(urlset|sitemapindex)/i.test(sitemap.text)) {
		if (/<sitemapindex/i.test(sitemap.text)) {
			const children = locs(sitemap.text)
				.filter((u) => u.startsWith(`${origin}/`))
				.slice(0, 5);
			for (const child of children) {
				if (o.signal?.aborted) break;
				const got = await tryGet(child);
				if (got && ok(got)) discovered.push(...locs(got.text));
			}
		} else {
			discovered = locs(sitemap.text);
		}
	}
	if (discovered.length === 0) discovered = homePage.internalLinks;

	const seen = new Set<string>([homeUrl, landing, `${origin}/`]);
	const candidates: string[] = [];
	for (const raw of discovered) {
		let url: URL;
		try {
			url = new URL(raw);
		} catch {
			continue;
		}
		url.hash = "";
		if (url.origin !== origin || ASSET.test(url.pathname)) continue;
		const key = url.toString();
		if (seen.has(key)) continue;
		seen.add(key);
		candidates.push(key);
	}
	const chosen = candidates.slice(0, maxPages - 1);
	const skipped = candidates.slice(maxPages - 1);

	const pathOf = (url: string) => {
		try {
			const parsed = new URL(url);
			return `${parsed.pathname}${parsed.search}`;
		} catch {
			return "/";
		}
	};
	const findings: Finding[] = checkSite({ origin, robots, llms, paths: [landing, ...chosen].map(pathOf) });

	const pages: (AuditPage | null)[] = [
		{ url: landing, status: home.status, words: homePage.words },
		...chosen.map(() => null),
	];
	const perPage: Finding[][] = [checkPage(homePage, startedAt), ...chosen.map(() => [])];

	let next = 0;
	async function worker() {
		while (!o.signal?.aborted) {
			const index = next;
			const url = chosen[index];
			if (url === undefined) return;
			next += 1;
			try {
				const got = await o.get(url);
				if (!ok(got))
					pages[index + 1] = {
						url,
						status: got.status,
						words: 0,
						error: `The server answered with status ${got.status}.`,
					};
				else if (!isHtml(got)) pages[index + 1] = { url, status: got.status, words: 0, error: NOT_A_PAGE };
				else {
					const page = parsePage(url, got.text);
					pages[index + 1] = { url, status: got.status, words: page.words };
					perPage[index + 1] = checkPage(page, startedAt);
				}
			} catch (error) {
				pages[index + 1] = { url, status: 0, words: 0, error: messageOf(error) };
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, chosen.length) }, worker));

	findings.push(...perPage.flat());
	const done = pages.filter((p): p is AuditPage => p !== null);
	return { origin, startedAt, pages: done, findings, score: scoreOf(findings, done), skipped };
}
