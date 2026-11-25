import type { Ok, ProjectDetail, ProjectView, StateResponse } from "../../api-types";
import { forgetPlan } from "../../plan";
import type { ApiDeps } from "../api";
import { json, notFound, read, requireProject } from "../http";
import { type Route, route } from "../router";
import { CompetitorsSchema, CreateProjectSchema, ProjectSchema } from "../schemas";

export function projectRoutes({ store, runs, audits, engines }: ApiDeps): Route[] {
	const detail = async (id: string): Promise<ProjectDetail> => ({
		project: await requireProject(store, id),
		competitors: await store.competitors.list(id),
		prompts: await store.prompts.list(id),
	});

	return [
		route("GET", "/api/state", async () =>
			json<StateResponse>({ projects: await store.projects.list(), engines: await engines() }),
		),
		route("POST", "/api/projects", async ({ request }) => {
			const input = await read(request, CreateProjectSchema);
			const created = await store.projects.create(input);
			await store.competitors.replace(created.id, input.competitors);
			await store.prompts.add(created.id, input.prompts);
			return json(await detail(created.id), 201);
		}),
		route("GET", "/api/projects/:id", async ({ params }) => json(await detail(params.id as string))),
		route("PATCH", "/api/projects/:id", async ({ request, params }) => {
			const id = params.id as string;
			const updated = await store.projects.update(id, await read(request, ProjectSchema));
			if (!updated) throw notFound("That project");
			return json<{ project: ProjectView }>({ project: updated });
		}),
		route("DELETE", "/api/projects/:id", async ({ params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			const run = await store.runs.active(id);
			if (run) runs.cancel(run.id);
			const audit = await store.audits.active(id);
			if (audit) audits?.cancel(audit.id);
			await forgetPlan(store, id);
			await store.projects.remove(id);
			return json<Ok>({ ok: true });
		}),
		route("PUT", "/api/projects/:id/competitors", async ({ request, params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			const input = await read(request, CompetitorsSchema);
			return json({ competitors: await store.competitors.replace(id, input.competitors) });
		}),
	];
}
