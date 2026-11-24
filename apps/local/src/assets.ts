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

const TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".woff2": "font/woff2",
	".svg": "image/svg+xml",
	".json": "application/json",
};

export function embeddedAssets(files: Record<string, string>): (path: string) => Response | null {
	return (path) => {
		const file = files[path];
		if (!file) return null;
		const type = TYPES[path.slice(path.lastIndexOf("."))] ?? "application/octet-stream";
		return new Response(Bun.file(file), { headers: { "content-type": type } });
	};
}
