import { expect, test } from "bun:test";
import { allowedHost, validToken } from "../src/server/guard";

const from = (headers: Record<string, string>) => new Request("http://127.0.0.1:4747/api/state", { headers });

test("only this machine's own address is an allowed host", () => {
	expect(allowedHost(from({ host: "127.0.0.1:4747" }), 4747)).toBe(true);
	expect(allowedHost(from({ host: "localhost:4747" }), 4747)).toBe(true);
	expect(allowedHost(from({ host: "127.0.0.1:9999" }), 4747)).toBe(false);
	expect(allowedHost(from({ host: "evil.example:4747" }), 4747)).toBe(false);
	expect(allowedHost(from({ host: "[::1]:4747" }), 4747)).toBe(false);
});

test("a request from another site is refused even with the right host", () => {
	const host = "127.0.0.1:4747";
	expect(allowedHost(from({ host, origin: "http://127.0.0.1:4747" }), 4747)).toBe(true);
	expect(allowedHost(from({ host, origin: "https://evil.example" }), 4747)).toBe(false);
	expect(allowedHost(from({ host, origin: "null" }), 4747)).toBe(false);
	expect(allowedHost(from({ host, origin: "http://127.0.0.1:9999" }), 4747)).toBe(false);
});

test("the token must match exactly", () => {
	expect(validToken(from({ "x-openaeo-token": "secret" }), "secret")).toBe(true);
	expect(validToken(from({ "x-openaeo-token": "secreT" }), "secret")).toBe(false);
	expect(validToken(from({ "x-openaeo-token": "secret-and-more" }), "secret")).toBe(false);
	expect(validToken(from({}), "secret")).toBe(false);
});
