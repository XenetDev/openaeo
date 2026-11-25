import { type ApiDeps, createApi } from "./api";
import { allowedHost, validToken } from "./guard";
import { json } from "./http";

export type HandlerDeps = ApiDeps & {
	token: string;
	port: number;
	assets: (path: string) => Response | null;
};

export function createHandler(deps: HandlerDeps) {
	const api = createApi(deps);

	async function page(path: string): Promise<Response> {
		const asset = path !== "/" && path !== "/index.html" ? deps.assets(path) : null;
		if (asset) return asset;
		const index = deps.assets("/index.html");
		if (!index) return new Response("The OpenAEO dashboard files are missing from this build.", { status: 500 });
		const html = (await index.text()).replace("<head>", `<head><meta name="openaeo-token" content="${deps.token}">`);
		return new Response(html, {
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
				"x-frame-options": "DENY",
				"content-security-policy": "frame-ancestors 'none'",
				"referrer-policy": "no-referrer",
			},
		});
	}

	return async function handle(request: Request): Promise<Response> {
		if (!allowedHost(request, deps.port)) return json({ error: "This address is not allowed to use OpenAEO." }, 403);
		const path = new URL(request.url).pathname;
		const isApi = path === "/api" || path.startsWith("/api/");
		if (!isApi) {
			if (request.method !== "GET" && request.method !== "HEAD")
				return json({ error: "That address does not exist." }, 404);
			return page(path);
		}
		if (!validToken(request, deps.token)) return json({ error: "Reload the OpenAEO page and try again." }, 403);
		return api(request, path);
	};
}
