import { artefacts, type AuditResult, buildFixBrief, type Finding } from "@openaeo/engine";
import type { z } from "zod";
import { AuditError, type AuditService } from "../audits";
import type { EngineStatus } from "../engines";
import { buildReport } from "../report";
import { RunError, type RunService } from "../runs";
import type { Store, StoredAudit } from "../store/store";
import { fallbackPrompts, type SuggestContext } from "../suggest";
import { allowedHost, validToken } from "./guard";
import { AddPromptsSchema, CompetitorsSchema, CreateProjectSchema, EntitySchema, MASK, PatchPromptSchema, SECRET_SETTINGS, SettingsSchema, StartAuditSchema } from "./schemas";

export type HandlerDeps = {
	store: Store;
	runs: RunService;
	audits?: AuditService;
	engines: () => EngineStatus[];
	token: string;
	port: number;
	assets: (path: string) => Response | null;
	suggest?: (context: SuggestContext) => Promise<{ prompts: string[]; fallback: boolean }>;
};

class HttpError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const notFound = (what: string) => new HttpError(404, `${what} was not found.`);

async function read<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw new HttpError(400, "The request body is not valid JSON.");
	}
	const parsed = schema.safeParse(body);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const field = issue?.path.join(".");
		throw new HttpError(400, field ? `${field}: ${issue?.message}` : (issue?.message ?? "The request is not valid."));
	}
	return parsed.data;
}

const RUN_STATUS: Record<string, number> = { already_running: 409, no_prompts: 400, no_engines: 400, not_found: 404 };
const AUDIT_STATUS: Record<string, number> = { already_running: 409, no_url: 400, bad_url: 400, not_found: 404 };

export function resultOf(audit: StoredAudit, findings: Finding[]): AuditResult {
	return { origin: audit.origin, startedAt: audit.startedAt, pages: audit.pages, findings, score: audit.score ?? 0, skipped: [] };
}

export function createHandler(deps: HandlerDeps) {
	const { store, runs } = deps;

	function project(id: string) {
		const found = store.projects.get(id);
		if (!found) throw notFound("That project");
		return found;
	}

	function maskedSettings() {
		const all = store.settings.all();
		for (const key of SECRET_SETTINGS) {
			const value = all[key];
			if (value) all[key] = `${MASK}${value.slice(-4)}`;
		}
		return all;
	}

	async function api(request: Request, path: string): Promise<Response> {
		const method = request.method;
		const parts = path.split("/").filter(Boolean).slice(1);
		const [a, b, c] = parts;

		if (a === "state" && parts.length === 1 && method === "GET") {
			return json({ projects: store.projects.list(), engines: deps.engines() });
		}

		if (a === "projects" && parts.length === 1 && method === "POST") {
			const input = await read(request, CreateProjectSchema);
			const created = store.projects.create(input);
			store.competitors.replace(created.id, input.competitors);
			store.prompts.add(created.id, input.prompts);
			return json({ project: created, competitors: store.competitors.list(created.id), prompts: store.prompts.list(created.id) }, 201);
		}

		if (a === "projects" && b && parts.length === 2) {
			if (method === "GET") {
				const found = project(b);
				return json({ project: found, competitors: store.competitors.list(b), prompts: store.prompts.list(b) });
			}
			if (method === "PATCH") {
				project(b);
				return json({ project: store.projects.update(b, await read(request, EntitySchema)) });
			}
			if (method === "DELETE") {
				project(b);
				const active = store.runs.active(b);
				if (active) runs.cancel(active.id);
				store.projects.remove(b);
				return json({ ok: true });
			}
		}

		if (a === "projects" && b && parts.length === 3) {
			if (c === "competitors" && method === "PUT") {
				project(b);
				const input = await read(request, CompetitorsSchema);
				return json({ competitors: store.competitors.replace(b, input.competitors) });
			}
			if (c === "prompts" && method === "GET") {
				project(b);
				return json({ prompts: store.prompts.list(b) });
			}
			if (c === "prompts" && method === "POST") {
				project(b);
				const input = await read(request, AddPromptsSchema);
				store.prompts.add(b, input.texts);
				return json({ prompts: store.prompts.list(b) }, 201);
			}
			if (c === "runs" && method === "GET") {
				project(b);
				return json({ runs: store.runs.list(b, 50) });
			}
			if (c === "runs" && method === "POST") {
				try {
					return json({ run: runs.start(b) }, 202);
				} catch (error) {
					if (error instanceof RunError) throw new HttpError(RUN_STATUS[error.code] ?? 400, error.message);
					throw error;
				}
			}
			if (c === "suggestions" && method === "POST") {
				const found = project(b);
				const context = { brand: found.name, domains: found.domains, competitors: store.competitors.list(b).map((x) => x.name) };
				return json(deps.suggest ? await deps.suggest(context) : { prompts: fallbackPrompts(context), fallback: true });
			}
			if (c === "report" && method === "GET") {
				project(b);
				const runId = new URL(request.url).searchParams.get("run") ?? undefined;
				if (runId && store.runs.get(runId)?.projectId !== b) throw notFound("That run");
				return json(buildReport(store, b, { runId }));
			}
		}

		if (a === "projects" && b && c === "audits" && deps.audits) {
			if (parts.length === 3 && method === "POST") {
				const input = await read(request, StartAuditSchema);
				try {
					return json({ audit: deps.audits.start(b, input.url) }, 202);
				} catch (error) {
					if (error instanceof AuditError) throw new HttpError(AUDIT_STATUS[error.code] ?? 400, error.message);
					throw error;
				}
			}
			if (parts.length === 4 && parts[3] === "latest" && method === "GET") {
				const found = project(b);
				const audit = store.audits.latest(b);
				if (!audit) return json({ audit: null, findings: [], artefacts: {} });
				const findings = store.audits.findings(audit.id);
				return json({ audit, findings, artefacts: audit.status === "done" ? artefacts(resultOf(audit, findings), { name: found.name }) : {} });
			}
		}

		if (a === "audits" && b && deps.audits) {
			const audit = store.audits.get(b);
			if (!audit) throw notFound("That audit");
			if (parts.length === 3 && c === "cancel" && method === "POST") {
				deps.audits.cancel(b);
				return json({ ok: true });
			}
			if (parts.length === 3 && c === "brief" && method === "GET") {
				return new Response(buildFixBrief(resultOf(audit, store.audits.findings(b))), {
					headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
				});
			}
		}

		if (a === "prompts" && b && parts.length === 2) {
			if (!store.prompts.get(b)) throw notFound("That prompt");
			if (method === "PATCH") {
				store.prompts.setActive(b, (await read(request, PatchPromptSchema)).active);
				return json({ prompt: store.prompts.get(b) });
			}
			if (method === "DELETE") {
				store.prompts.remove(b);
				return json({ ok: true });
			}
		}

		if (a === "runs" && b) {
			const run = store.runs.get(b);
			if (!run) throw notFound("That run");
			if (parts.length === 2 && method === "GET") {
				const texts = new Map(store.prompts.list(run.projectId).map((p) => [p.id, p.text]));
				const answers = store.answers.listByRun(b).map((answer) => ({ ...answer, promptText: texts.get(answer.promptId) ?? "(deleted prompt)" }));
				return json({ run, answers });
			}
			if (parts.length === 3 && c === "cancel" && method === "POST") {
				runs.cancel(b);
				return json({ ok: true });
			}
		}

		if (a === "settings" && parts.length === 1) {
			if (method === "GET") return json({ settings: maskedSettings() });
			if (method === "PUT") {
				const input = await read(request, SettingsSchema);
				for (const [key, value] of Object.entries(input)) {
					if (value === undefined) continue;
					if (SECRET_SETTINGS.has(key) && value.startsWith(MASK)) continue;
					if (value === "") store.settings.remove(key);
					else store.settings.set(key, value);
				}
				return json({ settings: maskedSettings() });
			}
		}

		throw new HttpError(404, "That address does not exist.");
	}

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
				if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "That address does not exist." }, 404);
				return await page(path);
			}
			if (!validToken(request, deps.token)) return json({ error: "Reload the OpenAEO page and try again." }, 403);
			return await api(request, path);
		} catch (error) {
			if (error instanceof HttpError) return json({ error: error.message }, error.status);
			if (error instanceof Error && /needs a name/.test(error.message)) return json({ error: error.message }, 400);
			return json({ error: "Something went wrong inside OpenAEO. Try again." }, 500);
		}
	};
}
