import type { ArtefactsView, AuditView, FindingView, AnswerView, EngineInfo, EntityView, NewProject, ProjectView, PromptView, ReportView, RunView, Suggestions } from "@openaeo/ui";

const token = document.querySelector<HTMLMetaElement>('meta[name="openaeo-token"]')?.content ?? "";

export class ApiError extends Error {}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
	let response: Response;
	try {
		response = await fetch(path, {
			method,
			headers: { "x-openaeo-token": token, ...(body === undefined ? {} : { "content-type": "application/json" }) },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	} catch {
		throw new ApiError("OpenAEO is not responding. Check that it is still running in your terminal.");
	}
	const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
	if (!response.ok || data === null) throw new ApiError(data?.error ?? "Something went wrong. Try again.");
	return data;
}

export type ProjectDetail = { project: ProjectView; competitors: EntityView[]; prompts: PromptView[] };

export const api = {
	state: () => call<{ projects: ProjectView[]; engines: EngineInfo[] }>("GET", "/api/state"),
	project: (id: string) => call<ProjectDetail>("GET", `/api/projects/${id}`),
	createProject: (input: NewProject) => call<ProjectDetail>("POST", "/api/projects", input),
	updateProject: (id: string, input: EntityView) => call<{ project: ProjectView }>("PATCH", `/api/projects/${id}`, input),
	deleteProject: (id: string) => call<{ ok: true }>("DELETE", `/api/projects/${id}`),
	saveCompetitors: (id: string, competitors: EntityView[]) => call<{ competitors: EntityView[] }>("PUT", `/api/projects/${id}/competitors`, { competitors }),
	addPrompts: (id: string, texts: string[]) => call<{ prompts: PromptView[] }>("POST", `/api/projects/${id}/prompts`, { texts }),
	setPromptActive: (id: string, active: boolean) => call<{ prompt: PromptView }>("PATCH", `/api/prompts/${id}`, { active }),
	suggest: (id: string) => call<Suggestions>("POST", `/api/projects/${id}/suggestions`),
	promptStats: (id: string) => call<{ stats: import("./screens/prompts").PromptStat[] }>("GET", `/api/projects/${id}/prompt-stats`),
	removePrompt: (id: string) => call<{ ok: true }>("DELETE", `/api/prompts/${id}`),
	startRun: (id: string) => call<{ run: RunView }>("POST", `/api/projects/${id}/runs`),
	cancelRun: (id: string) => call<{ ok: true }>("POST", `/api/runs/${id}/cancel`),
	runs: (id: string) => call<{ runs: RunView[] }>("GET", `/api/projects/${id}/runs`),
	run: (id: string) => call<{ run: RunView; answers: AnswerView[] }>("GET", `/api/runs/${id}`),
	report: (id: string) => call<ReportView>("GET", `/api/projects/${id}/report`),
	latestAudit: (id: string) => call<{ audit: AuditView | null; findings: FindingView[]; artefacts: ArtefactsView }>("GET", `/api/projects/${id}/audits/latest`),
	startAudit: (id: string, url: string) => call<{ audit: AuditView }>("POST", `/api/projects/${id}/audits`, url ? { url } : {}),
	cancelAudit: (id: string) => call<{ ok: true }>("POST", `/api/audits/${id}/cancel`),
	auditBrief: async (id: string) => {
		const response = await fetch(`/api/audits/${id}/brief`, { headers: { "x-openaeo-token": token } });
		if (!response.ok) throw new ApiError("The fix brief could not be loaded.");
		return response.text();
	},
	settings: () => call<{ settings: Record<string, string> }>("GET", "/api/settings"),
	saveSettings: (settings: Record<string, string>) => call<{ settings: Record<string, string> }>("PUT", "/api/settings", settings),
};
