import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diskAssets } from "../src/assets";

test("disk assets never serve a file outside the dashboard folder", () => {
	const parent = mkdtempSync(join(tmpdir(), "openaeo-assets-"));
	const root = join(parent, "dist");
	mkdirSync(root);
	mkdirSync(join(parent, "dist-private"));
	writeFileSync(join(root, "index.html"), "<html></html>");
	writeFileSync(join(parent, "dist-private", "secret.txt"), "secret");
	writeFileSync(join(parent, "secret.txt"), "secret");
	const assets = diskAssets(root);
	expect(assets("/index.html")).not.toBeNull();
	expect(assets("/missing.js")).toBeNull();
	expect(assets("/../secret.txt")).toBeNull();
	expect(assets("/../dist-private/secret.txt")).toBeNull();
});
