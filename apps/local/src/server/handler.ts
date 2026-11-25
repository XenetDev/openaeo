import type { Provider } from "@openaeo/engine";
import type { AuditService } from "../audits";
import type { CompetitorContext, CompetitorIdea } from "../competitor-ideas";
import type { EngineStatus } from "../engines";
import { type Log, logError } from "../log";
import type { RunService } from "../runs";
import type { Awaitable, Store } from "../store/store";
import type { SuggestContext } from "../suggest";
import { allowedHost, validToken } from "./guard";
import { HttpError, json } from "./http";
import { createRouter } from "./router";
import { assistRoutes } from "./routes/assist";
import { auditRoutes } from "./routes/audits";
import { projectRoutes } from "./routes/projects";
import { promptRoutes } from "./routes/prompts";
import { runRoutes } from "./routes/runs";
import { settingsRoutes } from "./routes/settings";

export type HandlerDeps = {
	store: Store;
	runs: RunService;
	audits?: AuditService;
	engines: () => Awaitable<EngineStatus[]>;
	token: string;
	port: number;
	assets: (path: string) => Response | null;
	suggest?: (context: SuggestContext) => Promise<{ prompts: string[]; fallback: boolean }>;
	askProvider?: (engine?: string) => Awaitable<Provider | null>;
	describeSite?: (domain: string) => Promise<string | null>;
	competitorIdeas?: (context: CompetitorContext) => Promise<CompetitorIdea[]>;
	log?: Log;
};

export function createHandler(deps: HandlerDeps) {
	const log = deps.log ?? logError;
	const api = createRouter([
		...projectRoutes(deps),
		...promptRoutes(deps),
		...runRoutes(deps),
		...auditRoutes(deps),
		...assistRoutes(deps),
		...settingsRoutes(deps),
	]);

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
		try {
			if (!isApi) {
				if (request.method !== "GET" && request.method !== "HEAD")
					return json({ error: "That address does not exist." }, 404);
				return await page(path);
			}
			if (!validToken(request, deps.token)) return json({ error: "Reload the OpenAEO page and try again." }, 403);
			const response = await api(request, path);
			if (!response) throw new HttpError(404, "That address does not exist.");
			return response;
		} catch (error) {
			if (error instanceof HttpError) return json({ error: error.message }, error.status);
			log(`${request.method} ${path}`, error);
			return json({ error: "Something went wrong inside OpenAEO. Try again." }, 500);
		}
	};
}
