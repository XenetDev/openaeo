import type { Provider } from "@openaeo/engine";
import type { AskOptions } from "../ask";
import type { AuditService } from "../audits";
import type { CompetitorContext, CompetitorIdea } from "../competitor-ideas";
import type { EngineStatus } from "../engine-catalog";
import { type Log, logError } from "../log";
import type { RunService } from "../runs";
import type { Awaitable, Project, Store } from "../store/types";
import type { SuggestContext } from "../suggest";
import { HttpError, json } from "./http";
import { createRouter } from "./router";
import { assistRoutes } from "./routes/assist";
import { auditRoutes } from "./routes/audits";
import { projectRoutes } from "./routes/projects";
import { promptRoutes } from "./routes/prompts";
import { runRoutes } from "./routes/runs";
import { settingsRoutes } from "./routes/settings";

export type ApiDeps = {
	store: Store;
	runs: RunService;
	audits?: AuditService;
	engines: () => Awaitable<EngineStatus[]>;
	suggest?: (context: SuggestContext) => Promise<{ prompts: string[]; fallback: boolean }>;
	askProvider?: (engine?: string) => Awaitable<Provider | null>;
	describeSite?: (domain: string) => Promise<string | null>;
	competitorIdeas?: (context: CompetitorContext) => Promise<CompetitorIdea[]>;
	/** What the host app teaches Aeo about itself, and the changes Aeo may offer there. */
	assistant?: Pick<AskOptions, "guide" | "places" | "schedules"> & {
		facts?: (project: Project) => Promise<string[]>;
	};
	log?: Log;
};

export function createApi(deps: ApiDeps) {
	const log = deps.log ?? logError;
	const match = createRouter([
		...projectRoutes(deps),
		...promptRoutes(deps),
		...runRoutes(deps),
		...auditRoutes(deps),
		...assistRoutes(deps),
		...settingsRoutes(deps),
	]);

	return async function api(request: Request, path: string): Promise<Response> {
		try {
			const response = await match(request, path);
			if (!response) throw new HttpError(404, "That address does not exist.");
			return response;
		} catch (error) {
			if (error instanceof HttpError) return json({ error: error.message }, error.status);
			log(`${request.method} ${path}`, error);
			return json({ error: "Something went wrong inside OpenAEO. Try again." }, 500);
		}
	};
}
