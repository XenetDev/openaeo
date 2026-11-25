import type {
	AnswerView,
	EngineView,
	EntityView,
	LatestAudit,
	OpportunitiesView,
	PlanView,
	ProjectView,
	PromptStatView,
	PromptView,
	ReportView,
} from "@api";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toaster-clean";
import { ApiError, api } from "../api";
import { words } from "../wording";

export type ProjectData = {
	competitors: EntityView[];
	prompts: PromptView[];
	stats: PromptStatView[];
	report: ReportView;
	answers: AnswerView[];
	audit: LatestAudit;
	found: OpportunitiesView;
	plan: PlanView;
};

const STORED_PROJECT = "openaeo.project";
const POLL_MS = 2000;

export const messageOf = (error: unknown) =>
	error instanceof ApiError ? error.message : "Something went wrong. Try again.";

export function useWorkspace() {
	const [projects, setProjects] = useState<ProjectView[] | null>(null);
	const [engines, setEngines] = useState<EngineView[]>([]);
	const [settings, setSettings] = useState<Record<string, string>>({});
	const [projectId, setProjectId] = useState<string | null>(() => window.localStorage.getItem(STORED_PROJECT));
	const [data, setData] = useState<ProjectData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pickedTag, setTag] = useState("");
	const ticket = useRef(0);
	const tagRef = useRef("");
	const current = useRef<string | null>(null);

	const project = projects?.find((p) => p.id === projectId) ?? projects?.[0] ?? null;
	const currentId = project?.id ?? null;
	current.current = currentId;

	const loadState = useCallback(async () => {
		const [state, stored] = await Promise.all([api.state(), api.settings()]);
		setProjects(state.projects);
		setEngines(state.engines);
		setSettings(stored.settings);
	}, []);

	const loadProject = useCallback(async (id: string) => {
		ticket.current += 1;
		const mine = ticket.current;
		const [detail, report, audit, stats, found, plan] = await Promise.all([
			api.project(id),
			api.report(id, tagRef.current),
			api.latestAudit(id),
			api.promptStats(id),
			api.opportunities(id),
			api.plan(id),
		]);
		const answers = report.run ? (await api.run(report.run.id)).answers : [];
		if (mine !== ticket.current) return;
		setData({
			competitors: detail.competitors,
			prompts: detail.prompts,
			stats: stats.stats,
			report,
			answers,
			audit,
			found,
			plan,
		});
	}, []);

	const guard = useCallback(async (work: () => Promise<void>) => {
		setError(null);
		try {
			await work();
		} catch (caught) {
			setError(messageOf(caught));
			toast.error("That didn't work", { description: messageOf(caught) });
		}
	}, []);

	useEffect(() => {
		void guard(loadState);
	}, [guard, loadState]);

	useEffect(() => {
		setData(null);
		setTag("");
		tagRef.current = "";
		if (currentId) void guard(() => loadProject(currentId));
	}, [currentId, guard, loadProject]);

	const tags = [...new Set(data?.prompts.flatMap((prompt) => prompt.tags) ?? [])].sort((a, b) => a.localeCompare(b));
	const tag = tags.includes(pickedTag) ? pickedTag : "";
	useEffect(() => {
		if (tagRef.current === tag) return;
		tagRef.current = tag;
		if (currentId) void guard(() => loadProject(currentId));
	}, [tag, currentId, guard, loadProject]);

	const running = data?.report.run?.status === "running" || data?.audit.audit?.status === "running";
	useEffect(() => {
		if (!running || !currentId) return;
		let misses = 0;
		let seen = "";
		const timer = window.setInterval(() => {
			api
				.progress(currentId)
				.then((now) => {
					const key = `${now.run?.id}:${now.run?.status}:${now.run?.completed}:${now.audit?.id}:${now.audit?.status}`;
					if (key === seen) return;
					seen = key;
					return loadProject(currentId);
				})
				.then(
					() => {
						misses = 0;
					},
					() => {
						misses += 1;
						if (misses === 3) setError(words.lost);
					},
				);
		}, POLL_MS);
		return () => window.clearInterval(timer);
	}, [running, currentId, loadProject]);

	const select = useCallback((id: string) => {
		window.localStorage.setItem(STORED_PROJECT, id);
		setProjectId(id);
	}, []);

	const forget = useCallback(() => {
		window.localStorage.removeItem(STORED_PROJECT);
		setProjectId(null);
	}, []);

	const isCurrent = useCallback((id: string) => current.current === id, []);

	return {
		projects,
		engines,
		settings,
		project,
		data,
		tags,
		tag,
		setTag,
		error,
		clearError: useCallback(() => setError(null), []),
		engineReady: engines.some((engine) => engine.available && engine.enabled),
		loadState,
		loadProject,
		guard,
		select,
		forget,
		isCurrent,
	};
}

export type Workspace = ReturnType<typeof useWorkspace>;
