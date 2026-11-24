import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { $ } from "bun";

const root = join(import.meta.dir, "..");
const dist = join(root, "web", "dist");
const embeddedPath = join(root, "src", "embedded.ts");
const target = process.argv[2];
const outfile = join(root, "dist", target ? `openaeo-${target.replace(/^bun-/, "")}` : "openaeo");

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

await $`bun run build:web`.cwd(root).quiet();
const files = walk(dist);
const original = readFileSync(embeddedPath, "utf8");
const imports = files.map(
	(file, i) => `import f${i} from ${JSON.stringify(`../${relative(root, file)}`)} with { type: "file" };`,
);
const entries = files.map((file, i) => `\t${JSON.stringify(`/${relative(dist, file)}`)}: f${i},`);
writeFileSync(
	embeddedPath,
	`${imports.join("\n")}\n\nexport const embedded: Record<string, string> = {\n${entries.join("\n")}\n};\n`,
);
try {
	const flags = target ? ["--target", target] : [];
	await $`bun build --compile --minify ${flags} src/main.ts --outfile ${outfile}`.cwd(root);
} finally {
	writeFileSync(embeddedPath, original);
}
process.stdout.write(`${outfile}\n`);
