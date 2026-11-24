import type {
	AskReply,
	AskTurn,
	AuditView,
	CompetitorIdea,
	EntityView,
	LatestAudit,
	NewProject,
	Ok,
	OpportunitiesView,
	PlanView,
	Progress,
	ProjectDetail,
	ProjectView,
	PromptStatView,
	PromptView,
	ReportView,
	RunDetail,
	RunView,
	SettingsResponse,
	StateResponse,
	Suggestions,
} from "@api";
import { createSession, tokenIn } from "./session";

const session = createSession(
	document.querySelector<HTMLMetaElement>('meta[name="openaeo-token"]')?.content ?? "",
	async () => tokenIn(await (await fetch("/", { cache: "no-store" })).text()),
);

const send = (path: string, init: RequestInit = {}) =>
	session.send((token) => fetch(path, { ...init, headers: { ...init.headers, "x-openaeo-token": token } }));

export class ApiError extends Error {}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
	let response: Response;
	try {
		response = await send(path, {
			method,
			headers: body === undefined ? {} : { "content-type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	} catch {
		throw new ApiError("OpenAEO is not responding. Check that it is still running in your terminal.");
	}
	const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
	if (!response.ok || data === null) throw new ApiError(data?.error ?? "Something went wrong. Try again.");
	return data;
}

export const api = {
	state: () => call<StateResponse>("GET", "/api/state"),
	project: (id: string) => call<ProjectDetail>("GET", `/api/projects/${id}`),
	createProject: (input: NewProject) => call<ProjectDetail>("POST", "/api/projects", input),
	updateProject: (id: string, input: EntityView) =>
		call<{ project: ProjectView }>("PATCH", `/api/projects/${id}`, input),
	deleteProject: (id: string) => call<Ok>("DELETE", `/api/projects/${id}`),
	saveCompetitors: (id: string, competitors: EntityView[]) =>
		call<{ competitors: EntityView[] }>("PUT", `/api/projects/${id}/competitors`, { competitors }),
	addPrompts: (id: string, texts: string[]) =>
		call<{ prompts: PromptView[] }>("POST", `/api/projects/${id}/prompts`, { texts }),
	setPromptActive: (id: string, active: boolean) =>
		call<{ prompt: PromptView }>("PATCH", `/api/prompts/${id}`, { active }),
	setPromptTags: (id: string, tags: string[]) => call<{ prompt: PromptView }>("PATCH", `/api/prompts/${id}`, { tags }),
	exportAnswers: async (id: string) => {
		const response = await send(`/api/projects/${id}/export/answers.csv`);
		if (!response.ok) throw new ApiError("The export could not be created.");
		const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "answers.csv";
		return { name, blob: await response.blob() };
	},
	suggest: (id: string) => call<Suggestions>("POST", `/api/projects/${id}/suggestions`),
	promptStats: (id: string) => call<{ stats: PromptStatView[] }>("GET", `/api/projects/${id}/prompt-stats`),
	removePrompt: (id: string) => call<Ok>("DELETE", `/api/prompts/${id}`),
	startRun: (id: string) => call<{ run: RunView }>("POST", `/api/projects/${id}/runs`),
	cancelRun: (id: string) => call<Ok>("POST", `/api/runs/${id}/cancel`),
	ask: (id: string, body: { question: string; history: AskTurn[]; engine?: string }) =>
		call<AskReply>("POST", `/api/projects/${id}/ask`, body),
	competitorIdeas: (id: string) =>
		call<{ competitors: CompetitorIdea[] }>("POST", `/api/projects/${id}/competitor-ideas`),
	competitorIdeasFor: (name: string, domain?: string) =>
		call<{ competitors: CompetitorIdea[] }>("POST", "/api/competitor-ideas", { name, domain }),
	plan: (id: string) => call<PlanView>("GET", `/api/projects/${id}/plan`),
	setPlanStep: (id: string, step: string, done: boolean) =>
		call<PlanView>("PUT", `/api/projects/${id}/plan/${encodeURIComponent(step)}`, { done }),
	opportunities: (id: string) => call<OpportunitiesView>("GET", `/api/projects/${id}/opportunities`),
	progress: (id: string) => call<Progress>("GET", `/api/projects/${id}/progress`),
	runs: (id: string) => call<{ runs: RunView[] }>("GET", `/api/projects/${id}/runs`),
	run: (id: string) => call<RunDetail>("GET", `/api/runs/${id}`),
	report: (id: string, tag = "") =>
		call<ReportView>("GET", `/api/projects/${id}/report${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`),
	latestAudit: (id: string) => call<LatestAudit>("GET", `/api/projects/${id}/audits/latest`),
	startAudit: (id: string, url: string) =>
		call<{ audit: AuditView }>("POST", `/api/projects/${id}/audits`, url ? { url } : {}),
	cancelAudit: (id: string) => call<Ok>("POST", `/api/audits/${id}/cancel`),
	auditBrief: async (id: string) => {
		const response = await send(`/api/audits/${id}/brief`);
		if (!response.ok) throw new ApiError("The fix brief could not be loaded.");
		return response.text();
	},
	settings: () => call<SettingsResponse>("GET", "/api/settings"),
	saveSettings: (settings: Record<string, string>) => call<SettingsResponse>("PUT", "/api/settings", settings),
};
