import { expect, test } from "bun:test";
import { createSession, tokenIn } from "../web/src/session";

const reply = (status: number) => new Response("{}", { status });

test("a request that is accepted is sent once with the page's token", async () => {
	const seen: string[] = [];
	const session = createSession("first", async () => "second");
	const response = await session.send(async (token) => {
		seen.push(token);
		return reply(200);
	});
	expect(response.status).toBe(200);
	expect(seen).toEqual(["first"]);
});

test("a refused request is retried once with the token of the restarted app", async () => {
	const seen: string[] = [];
	const session = createSession("old", async () => "new");
	const response = await session.send(async (token) => {
		seen.push(token);
		return reply(token === "new" ? 200 : 403);
	});
	expect(response.status).toBe(200);
	expect(seen).toEqual(["old", "new"]);
});

test("later requests keep using the refreshed token", async () => {
	const seen: string[] = [];
	const session = createSession("old", async () => "new");
	const request = async (token: string) => {
		seen.push(token);
		return reply(token === "new" ? 200 : 403);
	};
	await session.send(request);
	await session.send(request);
	expect(seen).toEqual(["old", "new", "new"]);
});

test("a refusal is returned as it is when the token has not changed or cannot be read", async () => {
	for (const load of [async () => "same", async () => null]) {
		let sent = 0;
		const session = createSession("same", load);
		const response = await session.send(async () => {
			sent += 1;
			return reply(403);
		});
		expect(response.status).toBe(403);
		expect(sent).toBe(1);
	}
});

test("the token is read from the page the app serves", () => {
	expect(tokenIn('<head><meta name="openaeo-token" content="abc123"><title>x</title>')).toBe("abc123");
	expect(tokenIn("<head></head>")).toBeNull();
});
