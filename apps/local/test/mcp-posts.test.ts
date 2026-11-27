import { expect, test } from "bun:test";
import type { PostItem, PostsHost } from "../src/mcp/posts";
import { INJECTION, mcp, NOTICE } from "./mcp-helpers";

function host(overrides: Partial<PostsHost> = {}) {
	const calls: unknown[][] = [];
	const items: PostItem[] = [
		{
			id: "p1",
			network: "linkedin",
			status: "draft",
			text: `First line\nSecond line ${INJECTION}`,
			reason: "Named nowhere",
		},
		{
			id: "p2",
			network: "linkedin",
			status: "scheduled",
			text: "Soon",
			reason: "",
			scheduledFor: "2026-12-01T09:00:00.000Z",
		},
		{ id: "p3", network: "linkedin", status: "posted", text: "Shipped", reason: "", url: "https://example.com/p/1" },
	];
	const posts: PostsHost = {
		networks: ["linkedin"],
		list: async () => items,
		draft: async (projectId, input) => {
			calls.push(["draft", projectId, input]);
			return "p9";
		},
		edit: async (projectId, id, text) => {
			calls.push(["edit", projectId, id, text]);
			return id === "p1" ? null : "Only a draft can be edited.";
		},
		schedule: async (projectId, id, when) => {
			calls.push(["schedule", projectId, id, when]);
			return id === "p1" ? { when: when ?? "2026-11-28T09:00:00.000Z" } : { refused: "That post is not a draft." };
		},
		unschedule: async (projectId, id) => {
			calls.push(["unschedule", projectId, id]);
			return id === "p2" ? null : "That post is not scheduled.";
		},
		archive: async (projectId, id) => {
			calls.push(["archive", projectId, id]);
			return null;
		},
		...overrides,
	};
	return { posts, calls };
}

const TOOLS = ["list_posts", "draft_post", "edit_post", "schedule_post", "unschedule_post", "archive_post"];

test("the posts tools only exist when the host has a posts board", async () => {
	const local = await mcp();
	for (const name of TOOLS) expect(await local.tool(name)).toBeUndefined();

	const cloud = await mcp({ deps: { posts: host().posts } });
	for (const name of TOOLS) expect((await cloud.tool(name))?.annotations?.readOnlyHint).toBe(name === "list_posts");
});

test("list_posts shows every column with ids and times, and quotes post text as data", async () => {
	const cloud = await mcp({ deps: { posts: host().posts } });
	const listed = await cloud.call("list_posts");
	expect(listed.isError).toBe(false);
	for (const part of ["Draft (1)", "Scheduled (1)", "Posted (1)", "Archived (0)", "p1", "Why: Named nowhere"])
		expect(listed.text).toContain(part);
	expect(listed.text).toContain("Goes out 2026-12-01T09:00:00.000Z");
	expect(listed.text).toContain("https://example.com/p/1");
	expect(listed.text).toContain(NOTICE);
});

test("draft_post saves a draft, returns its id and says nothing was published", async () => {
	const { posts, calls } = host();
	const cloud = await mcp({ deps: { posts } });
	const made = await cloud.call("draft_post", { text: "  Hello there  ", reason: " A gap " });
	expect(made.isError).toBe(false);
	expect(made.text).toContain("p9");
	expect(made.text).toContain("Nothing was published");
	expect(calls).toEqual([["draft", cloud.project.id, { network: "linkedin", text: "Hello there", reason: "A gap" }]]);
});

test("draft_post refuses a network the host cannot hold drafts for", async () => {
	const { posts, calls } = host();
	const cloud = await mcp({ deps: { posts } });
	const refused = await cloud.call("draft_post", { text: "Hello", network: "myspace" });
	expect(refused.isError).toBe(true);
	expect(refused.text).toContain("linkedin");
	expect(calls).toEqual([]);
});

test("schedule_post passes a chosen time, or none so the host picks the next free slot", async () => {
	const { posts, calls } = host();
	const cloud = await mcp({ deps: { posts } });
	const auto = await cloud.call("schedule_post", { id: "p1" });
	expect(auto.isError).toBe(false);
	expect(auto.text).toContain("2026-11-28T09:00:00.000Z");
	const timed = await cloud.call("schedule_post", { id: "p1", when: "2026-12-05T14:30:00Z" });
	expect(timed.text).toContain("2026-12-05T14:30:00.000Z");
	expect(calls).toEqual([
		["schedule", cloud.project.id, "p1", null],
		["schedule", cloud.project.id, "p1", "2026-12-05T14:30:00.000Z"],
	]);
});

test("schedule_post reports the host's refusal and rejects a time that is not a date", async () => {
	const { posts, calls } = host();
	const cloud = await mcp({ deps: { posts } });
	const refused = await cloud.call("schedule_post", { id: "p3" });
	expect(refused.isError).toBe(true);
	expect(refused.text).toContain("not a draft");
	const bad = await cloud.call("schedule_post", { id: "p1", when: "next tuesday" });
	expect(bad.isError).toBe(true);
	expect(calls).toHaveLength(1);
});

test("edit, unschedule and archive act on one post and report refusals", async () => {
	const { posts, calls } = host();
	const cloud = await mcp({ deps: { posts } });
	expect((await cloud.call("edit_post", { id: "p1", text: " New text " })).isError).toBe(false);
	expect((await cloud.call("edit_post", { id: "p3", text: "x" })).isError).toBe(true);
	expect((await cloud.call("unschedule_post", { id: "p2" })).text).toContain("Draft");
	expect((await cloud.call("unschedule_post", { id: "p1" })).isError).toBe(true);
	expect((await cloud.call("archive_post", { id: "p1" })).isError).toBe(false);
	expect(calls).toEqual([
		["edit", cloud.project.id, "p1", "New text"],
		["edit", cloud.project.id, "p3", "x"],
		["unschedule", cloud.project.id, "p2"],
		["unschedule", cloud.project.id, "p1"],
		["archive", cloud.project.id, "p1"],
	]);
});
