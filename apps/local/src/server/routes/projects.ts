import type { Ok, ProjectDetail, ProjectView, StateResponse } from "../../api-types";
import type { HandlerDeps } from "../handler";
import { json, notFound, read, requireProject } from "../http";
import { type Route, route } from "../router";
import { CompetitorsSchema, CreateProjectSchema, EntitySchema } from "../schemas";

export function projectRoutes({ store, runs, audits, engines }: HandlerDeps): Route[] {
	const detail = (id: string): ProjectDetail => ({
		project: requireProject(store, id),
		competitors: store.competitors.list(id),
		prompts: store.prompts.list(id),
	});

	return [
		route("GET", "/api/state", () => json<StateResponse>({ projects: store.projects.list(), engines: engines() })),
		route("POST", "/api/projects", async ({ request }) => {
			const input = await read(request, CreateProjectSchema);
			const created = store.projects.create(input);
			store.competitors.replace(created.id, input.competitors);
			store.prompts.add(created.id, input.prompts);
			return json(detail(created.id), 201);
		}),
		route("GET", "/api/projects/:id", ({ params }) => json(detail(params.id as string))),
		route("PATCH", "/api/projects/:id", async ({ request, params }) => {
			const id = params.id as string;
			const updated = store.projects.update(id, await read(request, EntitySchema));
			if (!updated) throw notFound("That project");
			return json<{ project: ProjectView }>({ project: updated });
		}),
		route("DELETE", "/api/projects/:id", ({ params }) => {
			const id = params.id as string;
			requireProject(store, id);
			const run = store.runs.active(id);
			if (run) runs.cancel(run.id);
			const audit = store.audits.active(id);
			if (audit) audits?.cancel(audit.id);
			store.projects.remove(id);
			return json<Ok>({ ok: true });
		}),
		route("PUT", "/api/projects/:id/competitors", async ({ request, params }) => {
			const id = params.id as string;
			requireProject(store, id);
			const input = await read(request, CompetitorsSchema);
			return json({ competitors: store.competitors.replace(id, input.competitors) });
		}),
	];
}
