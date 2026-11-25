import type { AskReply, CompetitorIdea, Suggestions } from "../../api-types";
import { askContext, buildAskPrompt, splitActions } from "../../ask";
import { projectCompetitorContext } from "../../competitor-ideas";
import { fallbackPrompts, projectSuggestContext } from "../../suggest";
import type { ApiDeps } from "../api";
import { HttpError, json, read, requireProject } from "../http";
import { type Route, route } from "../router";
import { AskSchema, CompetitorIdeasSchema } from "../schemas";

export function assistRoutes(deps: ApiDeps): Route[] {
	const { store } = deps;
	const describe = async (domain: string | undefined) =>
		domain && deps.describeSite ? await deps.describeSite(domain).catch(() => null) : null;

	return [
		route("POST", "/api/competitor-ideas", async ({ request }) => {
			const input = await read(request, CompetitorIdeasSchema);
			if (!deps.competitorIdeas) return json<{ competitors: CompetitorIdea[] }>({ competitors: [] });
			const competitors = await deps.competitorIdeas({
				brand: input.name,
				domains: input.domain ? [input.domain] : [],
				about: await describe(input.domain),
				questions: [],
				answers: [],
				existing: [],
				location: input.location,
			});
			return json<{ competitors: CompetitorIdea[] }>({ competitors });
		}),
		route("POST", "/api/projects/:id/competitor-ideas", async ({ params }) => {
			const project = await requireProject(store, params.id as string);
			if (!deps.competitorIdeas) return json<{ competitors: CompetitorIdea[] }>({ competitors: [] });
			const competitors = await deps.competitorIdeas(
				await projectCompetitorContext(store, project, await describe(project.domains[0])),
			);
			return json<{ competitors: CompetitorIdea[] }>({ competitors });
		}),
		route("POST", "/api/projects/:id/suggestions", async ({ params }) => {
			const project = await requireProject(store, params.id as string);
			const context = await projectSuggestContext(
				store,
				project,
				deps.suggest ? await describe(project.domains[0]) : null,
			);
			return json<Suggestions>(
				deps.suggest ? await deps.suggest(context) : { prompts: fallbackPrompts(context), fallback: true },
			);
		}),
		route("POST", "/api/projects/:id/ask", async ({ request, params }) => {
			const project = await requireProject(store, params.id as string);
			const input = await read(request, AskSchema);
			const provider = (await deps.askProvider?.(input.engine)) ?? null;
			if (!provider) throw new HttpError(503, "No AI engine is ready to answer. Connect one in Settings.");
			const prompt = buildAskPrompt(await askContext(store, project), input.history, input.question);
			try {
				const answer = await provider.ask(prompt, { timeoutMs: 180_000 });
				return json<AskReply>({ ...splitActions(answer.text), engine: provider.id });
			} catch (error) {
				throw new HttpError(
					502,
					error instanceof Error && error.message
						? `The engine could not answer: ${error.message}`
						: "The engine could not answer. Try again.",
				);
			}
		}),
	];
}
