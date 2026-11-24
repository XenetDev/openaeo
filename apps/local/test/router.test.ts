import { expect, test } from "bun:test";
import { createRouter, route } from "../src/server/router";

const request = (method: string) => new Request("http://127.0.0.1/", { method });

test("a route matches its method and path and receives the named parts", async () => {
	const router = createRouter([
		route("GET", "/api/projects/:id/runs/:run", ({ params }) => new Response(`${params.id}/${params.run}`)),
	]);
	const response = await router(request("GET"), "/api/projects/p1/runs/r9");
	expect(await response?.text()).toBe("p1/r9");
});

test("a different method, a longer path or a shorter path does not match", () => {
	const router = createRouter([route("GET", "/api/projects/:id", () => new Response("found"))]);
	expect(router(request("POST"), "/api/projects/p1")).toBeNull();
	expect(router(request("GET"), "/api/projects/p1/extra")).toBeNull();
	expect(router(request("GET"), "/api/projects")).toBeNull();
	expect(router(request("GET"), "/api/other/p1")).toBeNull();
});

test("the first matching route wins and a trailing slash is ignored", async () => {
	const router = createRouter([
		route("GET", "/api/state", () => new Response("fixed")),
		route("GET", "/api/:anything", () => new Response("named")),
	]);
	expect(await (await router(request("GET"), "/api/state/"))?.text()).toBe("fixed");
	expect(await (await router(request("GET"), "/api/else"))?.text()).toBe("named");
});
