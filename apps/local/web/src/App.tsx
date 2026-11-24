import {
	AnswersPage,
	type AnswerView,
	AppShell,
	type ArtefactsView,
	AuditPage,
	type AuditView,
	type FindingView,
	CompetitorsPage,
	type EngineInfo,
	type EntityView,
	Onboarding,
	Overview,
	type PageId,
	type ProjectView,
	PromptsPage,
	type PromptView,
	type ReportView,
	type Suggestions,
	SettingsPage,
	SourcesPage,
} from "@openaeo/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";

const PAGES: PageId[] = ["overview", "prompts", "answers", "sources", "competitors", "audit", "settings"];
const pageFromHash = (): PageId => PAGES.find((p) => p === window.location.hash.slice(1)) ?? "overview";
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "Something went wrong. Try again.");

type AuditData = { audit: AuditView | null; findings: FindingView[]; artefacts: ArtefactsView };
type Data = { competitors: EntityView[]; prompts: PromptView[]; report: ReportView; answers: AnswerView[]; audit: AuditData };

export function App() {
	const [projects, setProjects] = useState<ProjectView[] | null>(null);
	const [engines, setEngines] = useState<EngineInfo[]>([]);
	const [settings, setSettings] = useState<Record<string, string>>({});
	const [projectId, setProjectId] = useState<string | null>(() => window.localStorage.getItem("openaeo.project"));
	const [data, setData] = useState<Data | null>(null);
	const [page, setPage] = useState<PageId>(pageFromHash);
	const [creating, setCreating] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
	const [suggesting, setSuggesting] = useState(false);
	const loading = useRef(0);

	const project = projects?.find((p) => p.id === projectId) ?? projects?.[0] ?? null;
	const currentId = project?.id ?? null;

	const loadState = useCallback(async () => {
		const [state, stored] = await Promise.all([api.state(), api.settings()]);
		setProjects(state.projects);
		setEngines(state.engines);
		setSettings(stored.settings);
	}, []);

	const loadProject = useCallback(async (id: string) => {
		const ticket = ++loading.current;
		const [detail, report, audit] = await Promise.all([api.project(id), api.report(id), api.latestAudit(id)]);
		const answers = report.run ? (await api.run(report.run.id)).answers : [];
		if (ticket !== loading.current) return;
		setData({ competitors: detail.competitors, prompts: detail.prompts, report, answers, audit });
	}, []);

	const guard = useCallback(async (work: () => Promise<void>) => {
		setError(null);
		try {
			await work();
		} catch (caught) {
			setError(messageOf(caught));
		}
	}, []);

	useEffect(() => {
		void guard(loadState);
	}, [guard, loadState]);

	useEffect(() => {
		const onHash = () => setPage(pageFromHash());
		window.addEventListener("hashchange", onHash);
		return () => window.removeEventListener("hashchange", onHash);
	}, []);

	useEffect(() => {
		setData(null);
		setSuggestions(null);
		if (currentId) void guard(() => loadProject(currentId));
	}, [currentId, guard, loadProject]);

	const [copied, setCopied] = useState(false);
	const running = data?.report.run?.status === "running" || data?.audit.audit?.status === "running";
	useEffect(() => {
		if (!running || !currentId) return;
		let misses = 0;
		const timer = window.setInterval(() => {
			loadProject(currentId).then(
				() => {
					misses = 0;
				},
				() => {
					misses += 1;
					if (misses === 3) setError("OpenAEO stopped responding. Check that it is still running in your terminal, then reload this page.");
				},
			);
		}, 2000);
		return () => window.clearInterval(timer);
	}, [running, currentId, loadProject]);

	const navigate = (next: PageId) => {
		window.location.hash = next;
		setPage(next);
		setError(null);
		setSaved(false);
	};

	const select = (id: string) => {
		window.localStorage.setItem("openaeo.project", id);
		setProjectId(id);
	};

	if (projects === null) {
		return <div className="oa-onboard">{error ? <p className="oa-alert">{error}</p> : <p className="oa-muted">Loading…</p>}</div>;
	}

	if (!project || creating) {
		return (
			<Onboarding
				engines={engines}
				busy={busy}
				error={error}
				onCancel={project ? () => setCreating(false) : undefined}
				onCreate={(input) => {
					setBusy(true);
					void guard(async () => {
						const created = await api.createProject(input);
						await loadState();
						select(created.project.id);
						setCreating(false);
						navigate(created.prompts.length ? "overview" : "prompts");
					}).finally(() => setBusy(false));
				}}
			/>
		);
	}

	const id = project.id;
	const refresh = () => loadProject(id);
	const act = (work: () => Promise<unknown>) => void guard(async () => {
		await work();
		await refresh();
	});

	const body = !data ? (
		<div className="oa-page">{error ? <p className="oa-alert">{error}</p> : <p className="oa-muted">Loading…</p>}</div>
	) : page === "overview" ? (
		<Overview
			project={project}
			report={data.report}
			engines={engines}
			error={error}
			onNavigate={navigate}
			onRun={() => act(() => api.startRun(id))}
			onCancel={() => act(async () => (data.report.run ? api.cancelRun(data.report.run.id) : undefined))}
		/>
	) : page === "prompts" ? (
		<>
			<PromptsPage
				prompts={data.prompts}
				onAdd={(texts) => act(() => api.addPrompts(id, texts))}
				onToggle={(promptId, active) => act(() => api.setPromptActive(promptId, active))}
				onRemove={(promptId) => act(() => api.removePrompt(promptId))}
				suggestions={suggestions}
				suggesting={suggesting}
				onSuggest={() => {
					setSuggesting(true);
					void guard(async () => setSuggestions(await api.suggest(id))).finally(() => setSuggesting(false));
				}}
			/>
		</>
	) : page === "answers" ? (
		<AnswersPage answers={data.answers} project={project} competitors={data.competitors.flatMap((c) => [c.name, ...c.aliases])} engines={engines} />
	) : page === "sources" ? (
		<SourcesPage report={data.report} />
	) : page === "audit" ? (
		<AuditPage
			key={`${id}:${data.audit.audit?.id ?? "none"}`}
			audit={data.audit.audit}
			findings={data.audit.findings}
			artefacts={data.audit.artefacts}
			defaultUrl={data.audit.audit?.origin ?? project.domains[0] ?? ""}
			copied={copied}
			onRun={(url) => act(() => api.startAudit(id, url))}
			onCancel={() => act(async () => (data.audit.audit ? api.cancelAudit(data.audit.audit.id) : undefined))}
			onCopyBrief={() =>
				void guard(async () => {
					if (!data.audit.audit) return;
					await navigator.clipboard.writeText(await api.auditBrief(data.audit.audit.id));
					setCopied(true);
					window.setTimeout(() => setCopied(false), 2500);
				})
			}
		/>
	) : page === "competitors" ? (
		<CompetitorsPage key={data.competitors.map((c) => c.name).join("|")} report={data.report} competitors={data.competitors} onSave={(next) => act(() => api.saveCompetitors(id, next))} />
	) : (
		<>
			<SettingsPage
				key={`${id}:${JSON.stringify(settings)}`}
				engines={engines}
				settings={settings}
				project={project}
				saved={saved}
				onSave={(next) =>
					void guard(async () => {
						await api.saveSettings(next);
						await loadState();
						setSaved(true);
					})
				}
				onSaveProject={(next) =>
					void guard(async () => {
						await api.updateProject(id, next);
						await loadState();
						await refresh();
						setSaved(true);
					})
				}
				onDeleteProject={() =>
					void guard(async () => {
						await api.deleteProject(id);
						window.localStorage.removeItem("openaeo.project");
						setProjectId(null);
						await loadState();
						navigate("overview");
					})
				}
			/>
		</>
	);

	return (
		<AppShell projects={projects} project={project} page={page} onNavigate={navigate} onSelectProject={select} onNewProject={() => setCreating(true)}>
			{error && data && page !== "overview" ? (
				<p className="oa-alert oa-floating" role="alert">
					{error}
				</p>
			) : null}
			{body}
		</AppShell>
	);
}
