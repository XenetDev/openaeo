import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const ALL = ["bun-darwin-arm64", "bun-darwin-x64", "bun-linux-x64", "bun-linux-arm64"];
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const root = join(import.meta.dir, "..");
const out = join(root, "dist", "release");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const sums: string[] = [];
for (const target of targets) {
	const name = `openaeo-${target.replace(/^bun-/, "")}`;
	await $`bun scripts/build.ts ${target}`.cwd(root).quiet();
	renameSync(join(root, "dist", name), join(out, name));
	await $`tar -czf ${name}.tar.gz ${name}`.cwd(out);
	rmSync(join(out, name));
	const hash = createHash("sha256")
		.update(readFileSync(join(out, `${name}.tar.gz`)))
		.digest("hex");
	sums.push(`${hash}  ${name}.tar.gz`);
	process.stdout.write(`${name}.tar.gz\n`);
}
writeFileSync(join(out, "checksums.txt"), `${sums.join("\n")}\n`);
process.stdout.write(`${out}\n`);
