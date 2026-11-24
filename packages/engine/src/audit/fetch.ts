export type Fetched = { url: string; status: number; contentType: string; text: string; redirects: string[] };

export type AuditFetchErrorCode = "bad_url" | "blocked" | "too_large" | "timeout" | "too_many_redirects" | "network";

export class AuditFetchError extends Error {
	readonly code: AuditFetchErrorCode;

	constructor(code: AuditFetchErrorCode, message: string) {
		super(message);
		this.name = "AuditFetchError";
		this.code = code;
	}
}

export type SafeFetchOptions = {
	fetch?: typeof fetch;
	lookup?: (host: string) => Promise<string[]>;
	allowLoopback?: boolean;
	maxBytes?: number;
	timeoutMs?: number;
	maxRedirects?: number;
	userAgent?: string;
};

export const DEFAULT_USER_AGENT = "OpenAEO-Audit/0 (+https://github.com/jdships/openaeo)";

const LOOPBACK_NAMES = /(^|\.)localhost$/i;
const BLOCKED_NAMES = /(^|\.)(local|internal)$/i;

function v4Private(parts: number[]): boolean {
	const [a, b] = parts as [number, number, number, number];
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 192 && b === 0) ||
		(a === 198 && (b === 18 || b === 19)) ||
		a >= 224
	);
}

function parseV4(ip: string): number[] | null {
	const parts = ip.split(".");
	if (parts.length !== 4) return null;
	const numbers = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : Number.NaN));
	return numbers.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? numbers : null;
}

function parseV6(value: string): number[] | null {
	let text = value;
	const lastColon = text.lastIndexOf(":");
	const tail = text.slice(lastColon + 1);
	if (tail.includes(".")) {
		const v4 = parseV4(tail);
		if (!v4) return null;
		const [a, b, c, d] = v4 as [number, number, number, number];
		text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}
	const halves = text.split("::");
	if (halves.length > 2) return null;
	const toGroups = (part: string) => (part === "" ? [] : part.split(":"));
	const head = toGroups(halves[0] ?? "");
	const rest = halves.length === 2 ? toGroups(halves[1] ?? "") : [];
	const missing = 8 - head.length - rest.length;
	if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
	const groups = [...head, ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => "0"), ...rest];
	if (groups.length !== 8) return null;
	const numbers = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? Number.parseInt(g, 16) : Number.NaN));
	return numbers.every((n) => Number.isInteger(n)) ? numbers : null;
}

const embedded = (high: number, low: number) => v4Private([high >> 8, high & 255, low >> 8, low & 255]);

export function isPrivateAddress(ip: string): boolean {
	const value = ip
		.trim()
		.toLowerCase()
		.replace(/^\[|\]$/g, "")
		.replace(/%.*$/, "");
	const v4 = parseV4(value);
	if (v4) return v4Private(v4);
	const g = parseV6(value);
	if (!g) return true;
	const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [number, number, number, number, number, number, number, number];
	const leadingZeros = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
	if (leadingZeros && (g5 === 0 || g5 === 0xffff)) return g5 === 0 ? true : embedded(g6, g7);
	if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return embedded(g6, g7);
	if (g0 === 0x2002) return embedded(g1, g2);
	if ((g0 & 0xfe00) === 0xfc00) return true;
	if ((g0 & 0xffc0) === 0xfe80) return true;
	if ((g0 & 0xffc0) === 0xfec0) return true;
	if ((g0 & 0xff00) === 0xff00) return true;
	if (g0 === 0x2001 && g1 === 0x0db8) return true;
	return false;
}

export function isLoopbackAddress(ip: string): boolean {
	const value = ip
		.trim()
		.toLowerCase()
		.replace(/^\[|\]$/g, "")
		.replace(/%.*$/, "");
	const v4 = parseV4(value);
	if (v4) return v4[0] === 127;
	const g = parseV6(value);
	if (!g) return false;
	const head = g.slice(0, 5).every((n) => n === 0);
	if (head && g[5] === 0 && g[6] === 0) return g[7] === 1;
	return head && g[5] === 0xffff && (g[6] as number) >> 8 === 127;
}

type Reach = "public" | "loopback" | "private";

async function defaultLookup(host: string): Promise<string[]> {
	const dns = await import("node:dns/promises");
	const records = await dns.lookup(host, { all: true });
	return records.map((r) => r.address);
}

export function createSafeFetch(o: SafeFetchOptions = {}): (url: string) => Promise<Fetched> {
	const fetcher = o.fetch ?? fetch;
	const lookup = o.lookup ?? defaultLookup;
	const maxBytes = o.maxBytes ?? 2 * 1024 * 1024;
	const timeoutMs = o.timeoutMs ?? 15_000;
	const maxRedirects = o.maxRedirects ?? 5;
	const userAgent = o.userAgent ?? DEFAULT_USER_AGENT;

	async function vet(raw: string, allowLoopbackHere: boolean, base?: string): Promise<{ url: URL; reach: Reach }> {
		let url: URL;
		try {
			url = base ? new URL(raw, base) : new URL(raw);
		} catch {
			throw new AuditFetchError("bad_url", "That is not a web address.");
		}
		if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
			throw new AuditFetchError("bad_url", "Only http and https addresses can be audited.");
		}
		url.username = "";
		url.password = "";
		url.hash = "";
		const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
		const literal = parseV4(host) !== null || host.includes(":");
		let reach: Reach;
		if (LOOPBACK_NAMES.test(host)) reach = "loopback";
		else if (BLOCKED_NAMES.test(host)) reach = "private";
		else {
			let addresses: string[];
			if (literal) {
				addresses = [host];
			} else {
				try {
					addresses = await lookup(host);
				} catch {
					throw new AuditFetchError("network", "The site's address could not be found.");
				}
				if (addresses.length === 0) throw new AuditFetchError("network", "The site's address could not be found.");
			}
			if (addresses.every(isLoopbackAddress)) reach = "loopback";
			else reach = addresses.some(isPrivateAddress) ? "private" : "public";
		}
		if (reach === "private" || (reach === "loopback" && !allowLoopbackHere)) {
			throw new AuditFetchError(
				"blocked",
				"That address points to a private or internal network, which OpenAEO will not fetch.",
			);
		}
		return { url, reach };
	}

	async function read(response: Response, signal: AbortSignal): Promise<string> {
		const declared = Number(response.headers.get("content-length"));
		if (Number.isFinite(declared) && declared > maxBytes) {
			await response.body?.cancel().catch(() => {});
			throw new AuditFetchError("too_large", "The page is larger than OpenAEO reads.");
		}
		if (!response.body) return "";
		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let size = 0;
		for (;;) {
			if (signal.aborted) {
				await reader.cancel().catch(() => {});
				throw new AuditFetchError("timeout", "The page took too long to load.");
			}
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBytes) {
				await reader.cancel().catch(() => {});
				throw new AuditFetchError("too_large", "The page is larger than OpenAEO reads.");
			}
			chunks.push(value);
		}
		const all = new Uint8Array(size);
		let offset = 0;
		for (const chunk of chunks) {
			all.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return new TextDecoder("utf-8", { fatal: false }).decode(all);
	}

	return async function get(raw: string): Promise<Fetched> {
		const signal = AbortSignal.timeout(timeoutMs);
		const redirects: string[] = [];
		const first = await vet(raw, o.allowLoopback === true);
		const allowLoopbackHops = first.reach === "loopback";
		let url = first.url;
		for (let hop = 0; ; hop += 1) {
			let response: Response;
			try {
				response = await fetcher(url.toString(), {
					method: "GET",
					redirect: "manual",
					signal,
					headers: {
						"user-agent": userAgent,
						"accept-encoding": "identity",
						accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.5",
					},
				});
			} catch {
				if (signal.aborted) throw new AuditFetchError("timeout", "The page took too long to load.");
				throw new AuditFetchError("network", "The site could not be reached.");
			}
			const location = response.headers.get("location");
			if (response.status >= 300 && response.status < 400 && location) {
				await response.body?.cancel().catch(() => {});
				if (hop >= maxRedirects) throw new AuditFetchError("too_many_redirects", "The page redirected too many times.");
				url = (await vet(location, allowLoopbackHops, url.toString())).url;
				redirects.push(url.toString());
				continue;
			}
			let text: string;
			try {
				text = await read(response, signal);
			} catch (error) {
				if (error instanceof AuditFetchError) throw error;
				if (signal.aborted) throw new AuditFetchError("timeout", "The page took too long to load.");
				throw new AuditFetchError("network", "The page could not be read.");
			}
			return {
				url: url.toString(),
				status: response.status,
				contentType: response.headers.get("content-type") ?? "",
				text,
				redirects,
			};
		}
	};
}
