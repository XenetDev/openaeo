import { expect, test } from "bun:test";
import type { PostsHost } from "../src/mcp/posts";
import { INJECTION, mcp, NOTICE } from "./mcp-helpers";

function host() {
	const drafted: { projectId: string; network: string; text: string; reason: string }[] = [];
	const posts: PostsHost = {
		networks: ["linkedin"],
		list: async () => [
			{ network: "linkedin", status: "draft", text: `First line\nSecond line ${INJECTION}`, reason: "Named nowhere" },
			{ network: "linkedin", status: "posted", text: "Shipped", reason: "", url: "https://example.com/p/1" },
		],
		draft: async (projectId, input) => {
			drafted.push({ projectId, ...input });
		},
	};
	return { posts, drafted };
}

test("the posts tools only exist when the host has a posts board", async () => {
	const local = await mcp();
	expect(await local.tool("list_posts")).toBeUndefined();
	expect(await local.tool("draft_post")).toBeUndefined();

	const cloud = await mcp({ deps: { posts: host().posts } });
	expect((await cloud.tool("list_posts"))?.annotations?.readOnlyHint).toBe(true);
	expect((await cloud.tool("draft_post"))?.annotations?.readOnlyHint).toBe(false);
});

test("list_posts shows the board by column and quotes the post text as data", async () => {
	const { posts } = host();
	const cloud = await mcp({ deps: { posts } });
	const listed = await cloud.call("list_posts");
	expect(listed.isError).toBe(false);
	expect(listed.text).toContain("Draft (1)");
	expect(listed.text).toContain("Posted (1)");
	expect(listed.text).toContain("Why: Named nowhere");
	expect(listed.text).toContain("https://example.com/p/1");
	expect(listed.text).toContain(NOTICE);
});

test("draft_post saves a draft for the brand and says nothing was published", async () => {
	const { posts, drafted } = host();
	const cloud = await mcp({ deps: { posts } });
	const made = await cloud.call("draft_post", { text: "  Hello there  ", reason: " A gap " });
	expect(made.isError).toBe(false);
	expect(made.text).toContain("Draft");
	expect(made.text).toContain("Nothing was published");
	expect(drafted).toEqual([{ projectId: cloud.project.id, network: "linkedin", text: "Hello there", reason: "A gap" }]);
});

test("draft_post refuses a network the host cannot hold drafts for", async () => {
	const { posts, drafted } = host();
	const cloud = await mcp({ deps: { posts } });
	const refused = await cloud.call("draft_post", { text: "Hello", network: "myspace" });
	expect(refused.isError).toBe(true);
	expect(refused.text).toContain("linkedin");
	expect(drafted).toEqual([]);
});
