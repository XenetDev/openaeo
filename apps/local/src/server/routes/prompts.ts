import type { Ok, PromptStatView, PromptView } from "../../api-types";
import { promptStats } from "../../report";
import type { HandlerDeps } from "../handler";
import { json, notFound, read, requireProject } from "../http";
import { type Route, route } from "../router";
import { AddPromptsSchema, PatchPromptSchema } from "../schemas";

export function promptRoutes({ store }: HandlerDeps): Route[] {
	const requirePrompt = (id: string) => {
		const found = store.prompts.get(id);
		if (!found) throw notFound("That prompt");
		return found;
	};

	return [
		route("GET", "/api/projects/:id/prompts", ({ params }) => {
			const id = params.id as string;
			requireProject(store, id);
			return json<{ prompts: PromptView[] }>({ prompts: store.prompts.list(id) });
		}),
		route("POST", "/api/projects/:id/prompts", async ({ request, params }) => {
			const id = params.id as string;
			requireProject(store, id);
			store.prompts.add(id, (await read(request, AddPromptsSchema)).texts);
			return json<{ prompts: PromptView[] }>({ prompts: store.prompts.list(id) }, 201);
		}),
		route("GET", "/api/projects/:id/prompt-stats", ({ params }) => {
			const id = params.id as string;
			requireProject(store, id);
			return json<{ stats: PromptStatView[] }>({ stats: promptStats(store, id) });
		}),
		route("PATCH", "/api/prompts/:id", async ({ request, params }) => {
			const id = params.id as string;
			requirePrompt(id);
			store.prompts.setActive(id, (await read(request, PatchPromptSchema)).active);
			return json<{ prompt: PromptView }>({ prompt: requirePrompt(id) });
		}),
		route("DELETE", "/api/prompts/:id", ({ params }) => {
			const id = params.id as string;
			requirePrompt(id);
			store.prompts.remove(id);
			return json<Ok>({ ok: true });
		}),
	];
}
