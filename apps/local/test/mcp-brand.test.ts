import { expect, test } from "bun:test";
import { mcp } from "./mcp-helpers";

test("get_brand shows the name, websites, other names and location", async () => {
	const { call, store, project } = await mcp();
	store.projects.update(project.id, {
		name: "Pipedrive",
		aliases: ["Pipe"],
		domains: ["pipedrive.com"],
		location: "London, United Kingdom",
	});
	const out = await call("get_brand");
	expect(out.isError).toBe(false);
	expect(out.text).toContain("Pipedrive");
	expect(out.text).toContain("Websites: pipedrive.com");
	expect(out.text).toContain("Other names: Pipe");
	expect(out.text).toContain("Location: London, United Kingdom");
	expect(out.text).toContain("update_brand");
});

test("update_brand changes only what it is given and tidies websites", async () => {
	const { call, store, project } = await mcp();
	const out = await call("update_brand", {
		location: "  Berlin,   Germany ",
		websites: ["https://www.Pipedrive.com/pricing", "pipedrive.co.uk"],
	});
	expect(out.isError).toBe(false);
	const saved = store.projects.get(project.id);
	expect(saved?.location).toBe("Berlin, Germany");
	expect(saved?.domains).toEqual(["pipedrive.com", "pipedrive.co.uk"]);
	expect(saved?.name).toBe("Pipedrive");

	await call("update_brand", { other_names: ["Pipe", "PD"] });
	const again = store.projects.get(project.id);
	expect(again?.aliases).toEqual(["Pipe", "PD"]);
	expect(again?.location).toBe("Berlin, Germany");
	expect(again?.domains).toEqual(["pipedrive.com", "pipedrive.co.uk"]);

	await call("update_brand", { location: "" });
	expect(store.projects.get(project.id)?.location).toBe("");
});

test("update_brand can rename a brand but not onto another brand's name", async () => {
	const { call, store, project } = await mcp();
	store.projects.create({ name: "Acme", aliases: [], domains: [] });
	const clash = await call("update_brand", { name: "acme" });
	expect(clash.isError).toBe(true);
	expect(store.projects.get(project.id)?.name).toBe("Pipedrive");
	expect((await call("update_brand", { name: "Pipedrive CRM" })).isError).toBe(false);
	expect(store.projects.get(project.id)?.name).toBe("Pipedrive CRM");
});

test("update_brand refuses nothing to change, bad websites and input over the limits", async () => {
	const { call, store, project } = await mcp();
	const empty = await call("update_brand");
	expect(empty.isError).toBe(true);
	expect(empty.text).toMatch(/nothing to change/i);
	const bad = await call("update_brand", { websites: ["pipedrive.com", "not a site"] });
	expect(bad.isError).toBe(true);
	expect(bad.text).toContain("not a site");
	expect((await call("update_brand", { location: "x".repeat(81) })).isError).toBe(true);
	expect((await call("update_brand", { other_names: ["x".repeat(201)] })).isError).toBe(true);
	expect((await call("update_brand", { websites: Array.from({ length: 51 }, (_, i) => `s${i}.com`) })).isError).toBe(
		true,
	);
	expect(store.projects.get(project.id)?.domains).toEqual(["pipedrive.com"]);
});

test("create_brand adds a brand and says a first run must be started", async () => {
	const { call, store, tool } = await mcp();
	expect((await tool("create_brand"))?.description).toContain("run_prompts");
	const out = await call("create_brand", {
		name: "Acme Studio",
		websites: ["https://acme.studio/"],
		other_names: ["Acme"],
		location: "Lisbon, Portugal",
	});
	expect(out.isError).toBe(false);
	expect(out.text).toContain("add_questions");
	expect(out.text).toContain("run_prompts");
	const created = store.projects.list().find((p) => p.name === "Acme Studio");
	expect(created?.domains).toEqual(["acme.studio"]);
	expect(created?.aliases).toEqual(["Acme"]);
	expect(created?.location).toBe("Lisbon, Portugal");
	expect((await call("get_brand", { project: "Acme Studio" })).text).toContain("acme.studio");
	expect((await call("list_projects")).text).toContain("Acme Studio");
});

test("create_brand asks the host's limit first and refuses with its message", async () => {
	const asked: number[] = [];
	const { call, store } = await mcp({
		deps: {
			limits: {
				brands: async () => {
					asked.push(store.projects.list().length);
					return "Your plan allows 1 brand. Upgrade to add another.";
				},
			},
		},
	});
	const out = await call("create_brand", { name: "Acme" });
	expect(out.isError).toBe(true);
	expect(out.text).toBe("Your plan allows 1 brand. Upgrade to add another.");
	expect(asked).toEqual([1]);
	expect(store.projects.list().map((p) => p.name)).toEqual(["Pipedrive"]);
});

test("create_brand refuses a name already in use", async () => {
	const { call, store } = await mcp({ deps: { limits: { brands: async () => null } } });
	const out = await call("create_brand", { name: "pipedrive" });
	expect(out.isError).toBe(true);
	expect(out.text).toMatch(/already/i);
	expect(store.projects.list().length).toBe(1);
	expect((await call("create_brand", { name: "Acme" })).isError).toBe(false);
});

test("no tool can delete a brand or change which engines are used", async () => {
	const { client } = await mcp();
	const names = (await client.listTools()).tools.map((t) => t.name);
	expect(names.filter((name) => /delete|engine|setting/.test(name))).toEqual([]);
	expect(names.filter((name) => name.startsWith("remove_")).sort()).toEqual(["remove_competitor", "remove_question"]);
});
