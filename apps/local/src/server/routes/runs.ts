import type { Ok, OpportunitiesView, Progress, ReportView, RunDetail, RunView } from "../../api-types";
import { answersCsv } from "../../export";
import { buildOpportunities } from "../../opportunities";
import { buildReasons } from "../../reasons";
import { buildReport } from "../../report";
import { RunError } from "../../runs";
import type { HandlerDeps } from "../handler";
import { HttpError, json, notFound, requireProject } from "../http";
import { type Route, route } from "../router";

const STATUS: Record<string, number> = { already_running: 409, no_prompts: 400, no_engines: 400, not_found: 404 };

export function runRoutes({ store, runs }: HandlerDeps): Route[] {
	const requireRun = (id: string) => {
		const found = store.runs.get(id);
		if (!found) throw notFound("That run");
		return found;
	};

	return [
		route("GET", "/api/projects/:id/runs", ({ params }) => {
			const id = params.id as string;
			requireProject(store, id);
			return json<{ runs: RunView[] }>({ runs: store.runs.list(id, 50) });
		}),
		route("POST", "/api/projects/:id/runs", ({ params }) => {
			try {
				return json<{ run: RunView }>({ run: runs.start(params.id as string) }, 202);
			} catch (error) {
				if (error instanceof RunError) throw new HttpError(STATUS[error.code] ?? 400, error.message);
				throw error;
			}
		}),
		route("GET", "/api/projects/:id/progress", ({ params }) => {
			const id = params.id as string;
			requireProject(store, id);
			const audit = store.audits.latest(id);
			return json<Progress>({
				run: store.runs.latest(id),
				audit: audit ? { id: audit.id, status: audit.status } : null,
			});
		}),
		route("GET", "/api/projects/:id/report", ({ request, params }) => {
			const id = params.id as string;
			requireProject(store, id);
			const query = new URL(request.url).searchParams;
			const runId = query.get("run") ?? undefined;
			if (runId && store.runs.get(runId)?.projectId !== id) throw notFound("That run");
			return json<ReportView>(buildReport(store, id, { runId, tag: query.get("tag") ?? undefined }));
		}),
		route("GET", "/api/projects/:id/export/answers.csv", ({ request, params }) => {
			const project = requireProject(store, params.id as string);
			const runId = new URL(request.url).searchParams.get("run") ?? undefined;
			if (runId && store.runs.get(runId)?.projectId !== project.id) throw notFound("That run");
			const name =
				project.name
					.replace(/[^a-z0-9]+/gi, "-")
					.replace(/^-|-$/g, "")
					.toLowerCase() || "openaeo";
			return new Response(answersCsv(store, project.id, runId), {
				headers: {
					"content-type": "text/csv; charset=utf-8",
					"content-disposition": `attachment; filename="${name}-answers.csv"`,
					"cache-control": "no-store",
				},
			});
		}),
		route("GET", "/api/projects/:id/opportunities", ({ params }) => {
			const id = params.id as string;
			requireProject(store, id);
			return json<OpportunitiesView>({ ...buildOpportunities(store, id), reasons: buildReasons(store, id) });
		}),
		route("GET", "/api/runs/:id", ({ params }) => {
			const run = requireRun(params.id as string);
			const texts = new Map(store.prompts.list(run.projectId).map((p) => [p.id, p.text]));
			const answers = store.answers
				.listByRun(run.id)
				.map((answer) => ({ ...answer, promptText: texts.get(answer.promptId) ?? "(deleted prompt)" }));
			return json<RunDetail>({ run, answers });
		}),
		route("POST", "/api/runs/:id/cancel", ({ params }) => {
			runs.cancel(requireRun(params.id as string).id);
			return json<Ok>({ ok: true });
		}),
	];
}
