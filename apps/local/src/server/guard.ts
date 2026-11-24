import { timingSafeEqual } from "node:crypto";

export function allowedHost(request: Request, port: number): boolean {
	const host = request.headers.get("host");
	if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
	const origin = request.headers.get("origin");
	return origin === null || origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

export function validToken(request: Request, token: string): boolean {
	const given = Buffer.from(request.headers.get("x-openaeo-token") ?? "");
	const expected = Buffer.from(token);
	return given.length === expected.length && timingSafeEqual(given, expected);
}
