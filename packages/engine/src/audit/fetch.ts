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
	allowPrivate?: boolean;
	maxBytes?: number;
	timeoutMs?: number;
	maxRedirects?: number;
	userAgent?: string;
};

export const DEFAULT_USER_AGENT = "OpenAEO-Audit/0 (+https://github.com/jdships/openaeo)";

const BLOCKED_NAMES = /(^|\.)(localhost|local|internal)$/i;

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

export function isPrivateAddress(ip: string): boolean {
	const value = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
	const v4 = parseV4(value);
	if (v4) return v4Private(v4);
	if (!value.includes(":") || !/^[0-9a-f:.]+$/.test(value)) return true;
	const mapped = /^::ffff:(.+)$/.exec(value);
	if (mapped?.[1]) {
		const tail = mapped[1];
		const dotted = parseV4(tail);
		if (dotted) return v4Private(dotted);
		const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
		if (hex?.[1] && hex[2]) {
			const high = Number.parseInt(hex[1], 16);
			const low = Number.parseInt(hex[2], 16);
			return v4Private([high >> 8, high & 255, low >> 8, low & 255]);
		}
		return true;
	}
	if (value === "::" || value === "::1") return true;
	const first = Number.parseInt(value.split(":")[0] || "0", 16);
	if ((first & 0xfe00) === 0xfc00) return true;
	if ((first & 0xffc0) === 0xfe80) return true;
	if ((first & 0xff00) === 0xff00) return true;
	return false;
}

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

	async function vet(raw: string, base?: string): Promise<URL> {
		let url: URL;
		try {
			url = base ? new URL(raw, base) : new URL(raw);
		} catch {
			throw new AuditFetchError("bad_url", `"${raw.slice(0, 200)}" is not a web address.`);
		}
		if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
			throw new AuditFetchError("bad_url", "Only http and https addresses can be audited.");
		}
		url.username = "";
		url.password = "";
		url.hash = "";
		if (o.allowPrivate) return url;
		const host = url.hostname.replace(/^\[|\]$/g, "");
		const blocked = new AuditFetchError("blocked", `${url.hostname} points to a private or internal address, which OpenAEO will not fetch.`);
		if (BLOCKED_NAMES.test(host)) throw blocked;
		const literal = parseV4(host) !== null || host.includes(":");
		let addresses: string[];
		if (literal) {
			addresses = [host];
		} else {
			try {
				addresses = await lookup(host);
			} catch {
				throw new AuditFetchError("network", `${host} could not be found.`);
			}
			if (addresses.length === 0) throw new AuditFetchError("network", `${host} could not be found.`);
		}
		if (addresses.some(isPrivateAddress)) throw blocked;
		return url;
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
		let url = await vet(raw);
		for (let hop = 0; ; hop += 1) {
			let response: Response;
			try {
				response = await fetcher(url.toString(), {
					method: "GET",
					redirect: "manual",
					signal,
					headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.5" },
				});
			} catch (error) {
				if (signal.aborted) throw new AuditFetchError("timeout", "The page took too long to load.");
				throw new AuditFetchError("network", `Could not reach ${url.hostname}: ${error instanceof Error ? error.message : String(error)}`);
			}
			const location = response.headers.get("location");
			if (response.status >= 300 && response.status < 400 && location) {
				await response.body?.cancel().catch(() => {});
				if (hop >= maxRedirects) throw new AuditFetchError("too_many_redirects", "The page redirected too many times.");
				url = await vet(location, url.toString());
				redirects.push(url.toString());
				continue;
			}
			let text: string;
			try {
				text = await read(response, signal);
			} catch (error) {
				if (error instanceof AuditFetchError) throw error;
				if (signal.aborted) throw new AuditFetchError("timeout", "The page took too long to load.");
				throw new AuditFetchError("network", `Reading ${url.hostname} failed.`);
			}
			return { url: url.toString(), status: response.status, contentType: response.headers.get("content-type") ?? "", text, redirects };
		}
	};
}
