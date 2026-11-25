import type { Ok, PromptStatView, PromptView } from "../../api-types";
import { promptStats } from "../../report";
import type { HandlerDeps } from "../handler";
import { json, notFound, read, requireProject } from "../http";
import { type Route, route } from "../router";
import { AddPromptsSchema, PatchPromptSchema } from "../schemas";

export function promptRoutes({ store }: HandlerDeps): Route[] {
	const requirePrompt = async (id: string) => {
		const found = await store.prompts.get(id);
		if (!found) throw notFound("That prompt");
		return found;
	};

	return [
		route("GET", "/api/projects/:id/prompts", async ({ params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			return json<{ prompts: PromptView[] }>({ prompts: await store.prompts.list(id) });
		}),
		route("POST", "/api/projects/:id/prompts", async ({ request, params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			await store.prompts.add(id, (await read(request, AddPromptsSchema)).texts);
			return json<{ prompts: PromptView[] }>({ prompts: await store.prompts.list(id) }, 201);
		}),
		route("GET", "/api/projects/:id/prompt-stats", async ({ params }) => {
			const id = params.id as string;
			await requireProject(store, id);
			return json<{ stats: PromptStatView[] }>({ stats: await promptStats(store, id) });
		}),
		route("PATCH", "/api/prompts/:id", async ({ request, params }) => {
			const id = params.id as string;
			await requirePrompt(id);
			const input = await read(request, PatchPromptSchema);
			if (input.active !== undefined) await store.prompts.setActive(id, input.active);
			if (input.tags) await store.prompts.setTags(id, input.tags);
			return json<{ prompt: PromptView }>({ prompt: await requirePrompt(id) });
		}),
		route("DELETE", "/api/prompts/:id", async ({ params }) => {
			const id = params.id as string;
			await requirePrompt(id);
			await store.prompts.remove(id);
			return json<Ok>({ ok: true });
		}),
	];
}
