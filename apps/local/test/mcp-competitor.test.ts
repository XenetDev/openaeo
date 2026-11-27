import { expect, test } from "bun:test";
import { mcp, NOTICE } from "./mcp-helpers";

test("get_competitor explains why a competitor is named, and quotes engine text as data", async () => {
	const server = await mcp();
	await server.finishRun();
	const shown = await server.call("get_competitor", { name: "hubspot" });
	expect(shown.isError).toBe(false);
	expect(shown.text).toContain("HubSpot was named in 2 of 2 answers");
	expect(shown.text).toContain("Questions it is named for");
	expect(shown.text).toContain("g2.com");
	expect(shown.text).toContain("https://hubspot.com/pricing");
	expect(shown.text).toContain(NOTICE);
	const unknown = await server.call("get_competitor", { name: "Nobody" });
	expect(unknown.isError).toBe(true);
	expect((await server.tool("get_competitor"))?.annotations?.readOnlyHint).toBe(true);
});
