import { existsSync } from "node:fs";
import { join, normalize } from "node:path";

const WEB_DIST = join(import.meta.dir, "..", "web", "dist");

export function diskAssets(root = WEB_DIST): (path: string) => Response | null {
	return (path) => {
		const file = normalize(join(root, path));
		if (!file.startsWith(root) || !existsSync(file)) return null;
		return new Response(Bun.file(file));
	};
}
