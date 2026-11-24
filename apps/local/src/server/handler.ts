import type { Provider } from "@openaeo/engine";
import { type AuditResult, artefacts, buildFixBrief, type Finding } from "@openaeo/engine";
import type { z } from "zod";
import { askContext, buildAskPrompt, splitActions } from "../ask";
import { AuditError, type AuditService } from "../audits";
import type { CompetitorContext, CompetitorIdea } from "../competitor-ideas";
import type { EngineStatus } from "../engines";
import { type Log, logError } from "../log";
import { buildOpportunities } from "../opportunities";
import { buildReport, promptStats } from "../report";
import { RunError, type RunService } from "../runs";
import type { Store, StoredAudit } from "../store/store";
import { fallbackPrompts, type SuggestContext } from "../suggest";
import { allowedHost, validToken } from "./guard";
import {
	AddPromptsSchema,
	AskSchema,
	CompetitorIdeasSchema,
	CompetitorsSchema,
	CreateProjectSchema,
	EntitySchema,
	MASK,
	PatchPromptSchema,
	SECRET_SETTINGS,
	SettingsSchema,
	StartAuditSchema,
} from "./schemas";

export type HandlerDeps = {
	store: Store;
	runs: RunService;
	audits?: AuditService;
	engines: () => EngineStatus[];
	token: string;
	port: number;
	assets: (path: string) => Response | null;
	suggest?: (context: SuggestContext) => Promise<{ prompts: string[]; fallback: boolean }>;
	askProvider?: (engine?: string) => Provider | null;
	describeSite?: (domain: string) => Promise<string | null>;
	competitorIdeas?: (context: CompetitorContext) => Promise<CompetitorIdea[]>;
	log?: Log;
};

class HttpError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", "cache-control": "no-store" },
	});

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
	return {
		origin: audit.origin,
		startedAt: audit.startedAt,
		pages: audit.pages,
		findings,
		score: audit.score ?? 0,
		skipped: [],
	};
}

export function createHandler(deps: HandlerDeps) {
	const { store, runs } = deps;
	const log = deps.log ?? logError;

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
			return json(
				{ project: created, competitors: store.competitors.list(created.id), prompts: store.prompts.list(created.id) },
				201,
			);
		}

		if (a === "competitor-ideas" && parts.length === 1 && method === "POST") {
			const input = await read(request, CompetitorIdeasSchema);
			if (!deps.competitorIdeas) return json({ competitors: [] });
			const about = input.domain && deps.describeSite ? await deps.describeSite(input.domain).catch(() => null) : null;
			return json({
				competitors: await deps.competitorIdeas({
					brand: input.name,
					domains: input.domain ? [input.domain] : [],
					about,
					questions: [],
					answers: [],
					existing: [],
				}),
			});
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
				const run = store.runs.active(b);
				if (run) runs.cancel(run.id);
				const audit = store.audits.active(b);
				if (audit) deps.audits?.cancel(audit.id);
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
			if (c === "prompt-stats" && method === "GET") {
				project(b);
				return json({ stats: promptStats(store, b) });
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
				const about =
					found.domains[0] && deps.describeSite && deps.suggest
						? await deps.describeSite(found.domains[0]).catch(() => null)
						: null;
				const context = {
					brand: found.name,
					domains: found.domains,
					competitors: store.competitors.list(b).map((x) => x.name),
					existing: store.prompts.list(b).map((x) => x.text),
					about,
				};
				return json(deps.suggest ? await deps.suggest(context) : { prompts: fallbackPrompts(context), fallback: true });
			}
			if (c === "competitor-ideas" && method === "POST") {
				const found = project(b);
				if (!deps.competitorIdeas) return json({ competitors: [] });
				const about =
					found.domains[0] && deps.describeSite ? await deps.describeSite(found.domains[0]).catch(() => null) : null;
				const run = store.runs.list(b, 10).find((r) => r.status !== "running");
				const answers = run
					? store.answers
							.listByRun(run.id)
							.filter((x) => x.errorCode === null)
							.map((x) => x.text)
					: [];
				const existing = [...found.aliases, ...store.competitors.list(b).flatMap((x) => [x.name, ...x.aliases])];
				return json({
					competitors: await deps.competitorIdeas({
						brand: found.name,
						domains: found.domains,
						about,
						questions: store.prompts.list(b).map((x) => x.text),
						answers,
						existing,
					}),
				});
			}
			if (c === "ask" && method === "POST") {
				const found = project(b);
				const input = await read(request, AskSchema);
				const provider = deps.askProvider?.(input.engine) ?? null;
				if (!provider)
					throw new HttpError(
						503,
						"No AI engine is ready to answer. Connect Claude Code or Codex, then check Settings.",
					);
				const prompt = buildAskPrompt(askContext(store, found), input.history, input.question);
				try {
					const answer = await provider.ask(prompt, { timeoutMs: 180_000 });
					return json({ ...splitActions(answer.text), engine: provider.id });
				} catch (error) {
					throw new HttpError(
						502,
						error instanceof Error && error.message
							? `The engine could not answer: ${error.message}`
							: "The engine could not answer. Try again.",
					);
				}
			}
			if (c === "opportunities" && method === "GET") {
				project(b);
				return json(buildOpportunities(store, b));
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
				return json({
					audit,
					findings,
					artefacts:
						audit.status === "done" && audit.own ? artefacts(resultOf(audit, findings), { name: found.name }) : {},
				});
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
				if (audit.status !== "done")
					throw new HttpError(409, "That audit did not finish, so there is no brief. Run the audit again.");
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
				const answers = store.answers
					.listByRun(b)
					.map((answer) => ({ ...answer, promptText: texts.get(answer.promptId) ?? "(deleted prompt)" }));
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
				if (request.method !== "GET" && request.method !== "HEAD")
					return json({ error: "That address does not exist." }, 404);
				return await page(path);
			}
			if (!validToken(request, deps.token)) return json({ error: "Reload the OpenAEO page and try again." }, 403);
			return await api(request, path);
		} catch (error) {
			if (error instanceof HttpError) return json({ error: error.message }, error.status);
			log(`${request.method} ${path}`, error);
			return json({ error: "Something went wrong inside OpenAEO. Try again." }, 500);
		}
	};
}
