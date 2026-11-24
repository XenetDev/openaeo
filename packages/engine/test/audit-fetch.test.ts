import { expect, test } from "bun:test";
import { AuditFetchError, createSafeFetch, isPrivateAddress } from "../src/audit/fetch";

type Route = {
	status?: number;
	headers?: Record<string, string>;
	body?: string | ReadableStream<Uint8Array>;
	delayMs?: number;
};

function site(routes: Record<string, Route>, dns: Record<string, string[]> = {}) {
	const requested: { url: string; init?: RequestInit }[] = [];
	const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		requested.push({ url, init });
		const route = routes[url];
		if (!route) return new Response("not found", { status: 404 });
		if (route.delayMs) {
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(resolve, route.delayMs);
				init?.signal?.addEventListener("abort", () => {
					clearTimeout(timer);
					reject(new DOMException("aborted", "AbortError"));
				});
			});
		}
		return new Response(route.body ?? "", { status: route.status ?? 200, headers: route.headers });
	}) as typeof fetch;
	const lookup = async (host: string) => dns[host] ?? ["93.184.216.34"];
	return { fetcher, lookup, requested };
}

async function codeOf(run: Promise<unknown>) {
	try {
		await run;
	} catch (error) {
		if (error instanceof AuditFetchError) return error.code;
		throw error;
	}
	return "no error";
}

test("private, loopback, link-local and metadata addresses are recognised", () => {
	for (const ip of [
		"127.0.0.1",
		"10.1.2.3",
		"172.16.0.1",
		"172.31.255.255",
		"192.168.1.1",
		"169.254.169.254",
		"0.0.0.0",
		"100.64.0.1",
		"::1",
		"::",
		"fc00::1",
		"fd12:3456::1",
		"fe80::1",
		"::ffff:127.0.0.1",
		"::ffff:7f00:1",
		"::ffff:10.0.0.1",
		"not-an-ip",
	]) {
		expect([ip, isPrivateAddress(ip)]).toEqual([ip, true]);
	}
	for (const ip of [
		"93.184.216.34",
		"8.8.8.8",
		"172.32.0.1",
		"172.15.0.1",
		"100.128.0.1",
		"2606:4700:4700::1111",
		"::ffff:8.8.8.8",
	]) {
		expect([ip, isPrivateAddress(ip)]).toEqual([ip, false]);
	}
});

test("addresses that point inside a network are refused without a request", async () => {
	const { fetcher, lookup, requested } = site(
		{},
		{ "intranet.example.com": ["10.0.0.5"], "mixed.example.com": ["93.184.216.34", "127.0.0.1"] },
	);
	const get = createSafeFetch({ fetch: fetcher, lookup });
	for (const url of [
		"http://127.0.0.1/",
		"http://127.0.0.1:8080/admin",
		"http://169.254.169.254/latest/meta-data/",
		"http://[::1]/",
		"http://2130706433/",
		"http://0x7f.0.0.1/",
		"http://017700000001/",
		"http://localhost/",
		"http://app.localhost/",
		"http://printer.local/",
		"http://db.internal/",
		"http://intranet.example.com/",
		"http://mixed.example.com/",
		"http://[fd00::1]/",
		"http://[::ffff:127.0.0.1]/",
	]) {
		expect([url, await codeOf(get(url))]).toEqual([url, "blocked"]);
	}
	expect(requested).toEqual([]);
});

test("unsupported schemes and garbage are bad urls", async () => {
	const { fetcher, lookup } = site({});
	const get = createSafeFetch({ fetch: fetcher, lookup });
	for (const url of ["ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)", "not a url", "", "http://"]) {
		expect([url, await codeOf(get(url))]).toEqual([url, "bad_url"]);
	}
});

test("a normal page is returned with its final url, status and type", async () => {
	const { fetcher, lookup, requested } = site({
		"https://example.com/": { body: "<h1>Hi</h1>", headers: { "content-type": "text/html; charset=utf-8" } },
	});
	const got = await createSafeFetch({ fetch: fetcher, lookup, userAgent: "OpenAEO-Audit/test" })(
		"https://example.com/",
	);
	expect(got).toEqual({
		url: "https://example.com/",
		status: 200,
		contentType: "text/html; charset=utf-8",
		text: "<h1>Hi</h1>",
		redirects: [],
	});
	expect(new Headers(requested[0]?.init?.headers).get("user-agent")).toBe("OpenAEO-Audit/test");
	expect(requested[0]?.init?.redirect).toBe("manual");
	expect(requested[0]?.init?.method ?? "GET").toBe("GET");
});

test("error statuses are returned, not thrown", async () => {
	const { fetcher, lookup } = site({ "https://example.com/x": { status: 403, body: "no" } });
	const got = await createSafeFetch({ fetch: fetcher, lookup })("https://example.com/x");
	expect(got.status).toBe(403);
	expect((await createSafeFetch({ fetch: fetcher, lookup })("https://example.com/missing")).status).toBe(404);
});

test("redirects are followed by hand, relative ones included", async () => {
	const { fetcher, lookup } = site({
		"http://example.com/": { status: 301, headers: { location: "https://www.example.com/" } },
		"https://www.example.com/": { status: 302, headers: { location: "/home" } },
		"https://www.example.com/home": { body: "home" },
	});
	const got = await createSafeFetch({ fetch: fetcher, lookup })("http://example.com/");
	expect(got.url).toBe("https://www.example.com/home");
	expect(got.text).toBe("home");
	expect(got.redirects).toEqual(["https://www.example.com/", "https://www.example.com/home"]);
});

test("a redirect into a private address is refused at that hop", async () => {
	const { fetcher, lookup, requested } = site(
		{
			"https://example.com/": { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } },
			"https://example.com/b": { status: 302, headers: { location: "https://rebind.example.net/" } },
			"https://example.com/c": { status: 302, headers: { location: "file:///etc/passwd" } },
		},
		{ "rebind.example.net": ["192.168.0.10"] },
	);
	const get = createSafeFetch({ fetch: fetcher, lookup });
	expect(await codeOf(get("https://example.com/"))).toBe("blocked");
	expect(await codeOf(get("https://example.com/b"))).toBe("blocked");
	expect(await codeOf(get("https://example.com/c"))).toBe("bad_url");
	expect(requested.map((r) => r.url)).toEqual([
		"https://example.com/",
		"https://example.com/b",
		"https://example.com/c",
	]);
});

test("too many redirects stop", async () => {
	const routes: Record<string, Route> = {};
	for (let i = 0; i < 10; i += 1)
		routes[`https://example.com/${i}`] = { status: 302, headers: { location: `/${i + 1}` } };
	const { fetcher, lookup, requested } = site(routes);
	expect(await codeOf(createSafeFetch({ fetch: fetcher, lookup })("https://example.com/0"))).toBe("too_many_redirects");
	expect(requested.length).toBe(6);
});

test("a body over the cap stops being read", async () => {
	let pulled = 0;
	const endless = new ReadableStream<Uint8Array>({
		pull(controller) {
			pulled += 1;
			controller.enqueue(new Uint8Array(64 * 1024));
		},
	});
	const { fetcher, lookup } = site({ "https://example.com/big": { body: endless } });
	expect(
		await codeOf(createSafeFetch({ fetch: fetcher, lookup, maxBytes: 256 * 1024 })("https://example.com/big")),
	).toBe("too_large");
	expect(pulled).toBeLessThan(20);
});

test("a declared length over the cap is refused before reading", async () => {
	const { fetcher, lookup } = site({
		"https://example.com/big": { body: "x", headers: { "content-length": "999999999" } },
	});
	expect(await codeOf(createSafeFetch({ fetch: fetcher, lookup, maxBytes: 1000 })("https://example.com/big"))).toBe(
		"too_large",
	);
});

test("a slow response times out", async () => {
	const { fetcher, lookup } = site({ "https://example.com/slow": { delayMs: 500 } });
	const started = Date.now();
	expect(await codeOf(createSafeFetch({ fetch: fetcher, lookup, timeoutMs: 50 })("https://example.com/slow"))).toBe(
		"timeout",
	);
	expect(Date.now() - started).toBeLessThan(400);
});

test("network and lookup failures are reported as network errors", async () => {
	const failing = (async () => {
		throw new TypeError("connection refused");
	}) as unknown as typeof fetch;
	expect(
		await codeOf(createSafeFetch({ fetch: failing, lookup: async () => ["93.184.216.34"] })("https://example.com/")),
	).toBe("network");
	const { fetcher } = site({});
	expect(
		await codeOf(
			createSafeFetch({
				fetch: fetcher,
				lookup: async () => {
					throw new Error("ENOTFOUND");
				},
			})("https://nope.example/"),
		),
	).toBe("network");
	expect(await codeOf(createSafeFetch({ fetch: fetcher, lookup: async () => [] })("https://nope.example/"))).toBe(
		"network",
	);
});

test("allowPrivate lets the local app audit a site on this machine", async () => {
	const { fetcher, lookup } = site({
		"http://127.0.0.1:3000/": { body: "dev" },
		"http://localhost:3000/": { body: "dev2" },
	});
	const get = createSafeFetch({ fetch: fetcher, lookup, allowPrivate: true });
	expect((await get("http://127.0.0.1:3000/")).text).toBe("dev");
	expect((await get("http://localhost:3000/")).text).toBe("dev2");
	expect(await codeOf(get("file:///etc/passwd"))).toBe("bad_url");
});

test("credentials in the url are not sent on", async () => {
	const { fetcher, lookup, requested } = site({ "https://example.com/": { body: "ok" } });
	await createSafeFetch({ fetch: fetcher, lookup })("https://user:pass@example.com/");
	expect(requested[0]?.url).toBe("https://example.com/");
});
