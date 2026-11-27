import type {
	CompetitorInsightView,
	Ok,
	OpportunitiesView,
	PlanView,
	Progress,
	ReportView,
	RunDetail,
	RunView,
} from "../../api-types";
import { buildCompetitorInsight } from "../../competitor-insight";
import { answersCsv, questionsCsv } from "../../export";
import { buildOpportunities } from "../../opportunities";
import { buildPlan, setStepDone } from "../../plan";
import { buildReport } from "../../report";
import { RunError } from "../../runs";
import type { ApiDeps } from "../api";
import { HttpError, json, notFound, read, requireProject } from "../http";
import { type Route, route } from "../router";
import { PlanStepSchema } from "../schemas";

const STATUS: Record<string, number> = { already_running: 409, no_prompts: 400, no_engines: 400, not_found: 404 };

const slug = (name: string) =>
	name
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase() || "openaeo";

const csv = (name: string, body: string) =>
	new Response(body, {
		headers: {
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": `attachment; filename="${name}"`,
			"cache-control": "no-store",
		},
	});

export function runRoutes({ store, runs }: ApiDeps): Route[] {
	const requireRun = async (id: string) => {
		const found = await store.runs.get(id);
		if (!found) throw notFound("That run");
		return found;
	};

	return [
		route("GET", "/api/projects/:id/runs", async ({ params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			return json<{ runs: RunView[] }>({ runs: await store.runs.list(id, 50) });
		}),
		route("POST", "/api/projects/:id/runs", async ({ params }) => {
			try {
				return json<{ run: RunView }>({ run: await runs.start(params.id as string) }, 202);
			} catch (error) {
				if (error instanceof RunError) throw new HttpError(STATUS[error.code] ?? 400, error.message);
				throw error;
			}
		}),
		route("GET", "/api/projects/:id/progress", async ({ params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			const audit = await store.audits.latest(id);
			return json<Progress>({
				run: await store.runs.latest(id),
				audit: audit ? { id: audit.id, status: audit.status } : null,
			});
		}),
		route("GET", "/api/projects/:id/report", async ({ request, params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			const query = new URL(request.url).searchParams;
			const runId = query.get("run") ?? undefined;
			if (runId && (await store.runs.get(runId))?.projectId !== id) throw notFound("That run");
			return json<ReportView>(await buildReport(store, id, { runId, tag: query.get("tag") ?? undefined }));
		}),
		route("GET", "/api/projects/:id/export/answers.csv", async ({ request, params }) => {
			const project = await requireProject(store, params.id as string);
			const runId = new URL(request.url).searchParams.get("run") ?? undefined;
			if (runId && (await store.runs.get(runId))?.projectId !== project.id) throw notFound("That run");
			return csv(`${slug(project.name)}-answers.csv`, await answersCsv(store, project.id, runId));
		}),
		route("GET", "/api/projects/:id/export/questions.csv", async ({ params }) => {
			const project = await requireProject(store, params.id as string);
			return csv(`${slug(project.name)}-questions.csv`, await questionsCsv(store, project.id));
		}),
		route("GET", "/api/projects/:id/plan", async ({ params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			return json<PlanView>(await buildPlan(store, id));
		}),
		route("PUT", "/api/projects/:id/plan/:step", async ({ request, params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			const step = decodeURIComponent(params.step as string);
			if (!(await buildPlan(store, id)).steps.some((candidate) => candidate.id === step)) throw notFound("That step");
			await setStepDone(store, id, step, (await read(request, PlanStepSchema)).done);
			return json<PlanView>(await buildPlan(store, id));
		}),
		route("GET", "/api/projects/:id/competitors/:name/insight", async ({ params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			const insight = await buildCompetitorInsight(store, id, decodeURIComponent(params.name as string));
			if (!insight) throw notFound("That competitor");
			return json<CompetitorInsightView>(insight);
		}),
		route("GET", "/api/projects/:id/opportunities", async ({ params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			return json<OpportunitiesView>(await buildOpportunities(store, id));
		}),
		route("GET", "/api/runs/:id", async ({ params }) => {
			const run = await requireRun(params.id as string);
			const texts = new Map((await store.prompts.list(run.projectId)).map((p) => [p.id, p.text]));
			const answers = (await store.answers.listByRun(run.id)).map((answer) => ({
				...answer,
				promptText: texts.get(answer.promptId) ?? "(deleted prompt)",
			}));
			return json<RunDetail>({ run, answers });
		}),
		route("POST", "/api/runs/:id/cancel", async ({ params }) => {
			runs.cancel((await requireRun(params.id as string)).id);
			return json<Ok>({ ok: true });
		}),
	];
}
