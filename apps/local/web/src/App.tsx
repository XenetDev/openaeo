import type { AnswerView, ArtefactsView, AuditView, EngineInfo, EntityView, FindingView, PageId, ProjectView, PromptView, ReportView, Suggestions } from "@openaeo/ui";
import { BubbleChatIcon, CheckListIcon, DashboardSquare01Icon, Globe02Icon, News01Icon, PlusSignIcon, Search01Icon, Settings01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, type ShellNavItem } from "@/components/app-shell";
import { ApiError, api } from "./api";
import { AnswersScreen } from "./screens/answers";
import { AuditScreen } from "./screens/audit";
import { CompetitorsScreen, SourcesScreen } from "./screens/lists";
import { OverviewScreen } from "./screens/overview";
import { type PromptStat, PromptsScreen } from "./screens/prompts";
import { OnboardingScreen, SettingsScreen } from "./screens/settings";

const PAGES: { id: PageId; label: string; icon: ShellNavItem["icon"] }[] = [
	{ id: "overview", label: "Overview", icon: DashboardSquare01Icon },
	{ id: "prompts", label: "Prompts", icon: Search01Icon },
	{ id: "answers", label: "Answers", icon: BubbleChatIcon },
	{ id: "sources", label: "Sources", icon: News01Icon },
	{ id: "competitors", label: "Competitors", icon: UserMultipleIcon },
	{ id: "audit", label: "Audit", icon: CheckListIcon },
	{ id: "settings", label: "Settings", icon: Settings01Icon },
];
const NEW_BRAND = "Track another brand";
const pageFromHash = (): PageId => PAGES.find((p) => p.id === window.location.hash.slice(1))?.id ?? "overview";
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "Something went wrong. Try again.");

type AuditData = { audit: AuditView | null; findings: FindingView[]; artefacts: ArtefactsView };
type Data = { competitors: EntityView[]; prompts: PromptView[]; stats: PromptStat[]; report: ReportView; answers: AnswerView[]; audit: AuditData };

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
	const [copied, setCopied] = useState(false);
	const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
	const [suggesting, setSuggesting] = useState(false);
	const [answerFilter, setAnswerFilter] = useState("");
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
		const [detail, report, audit, stats] = await Promise.all([api.project(id), api.report(id), api.latestAudit(id), api.promptStats(id)]);
		const answers = report.run ? (await api.run(report.run.id)).answers : [];
		if (ticket !== loading.current) return;
		setData({ competitors: detail.competitors, prompts: detail.prompts, stats: stats.stats, report, answers, audit });
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
		setAnswerFilter("");
		if (currentId) void guard(() => loadProject(currentId));
	}, [currentId, guard, loadProject]);

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

	const shell = (children: React.ReactNode, active: string) => (
		<AppShell
			active={active}
			workspace={project?.name ?? "OpenAEO"}
			workspaceMeta="Local"
			user={{ name: "This computer" }}
			nav={project && !creating ? PAGES.map((p) => ({ label: p.label, icon: p.icon })) : []}
			groups={
				projects && projects.length > 0
					? [{ label: "Brands", items: [...projects.map((p) => ({ label: p.name, icon: Globe02Icon })), { label: NEW_BRAND, icon: PlusSignIcon }] }]
					: []
			}
			sideCards={false}
			onNavigate={(label) => {
				const target = PAGES.find((p) => p.label === label);
				if (target) {
					setCreating(false);
					return navigate(target.id);
				}
				if (label === NEW_BRAND) return setCreating(true);
				const brand = projects?.find((p) => p.name === label);
				if (brand) {
					setCreating(false);
					select(brand.id);
				}
			}}
		>
			{children}
		</AppShell>
	);

	if (projects === null) return shell(<div className="oa-view">{error ? <p className="oa-alert">{error}</p> : <p className="oa-dim">Loading…</p>}</div>, "");

	if (!project || creating) {
		return shell(
			<OnboardingScreen
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
			/>,
			NEW_BRAND,
		);
	}

	const id = project.id;
	const refresh = () => loadProject(id);
	const act = (work: () => Promise<unknown>) =>
		void guard(async () => {
			await work();
			await refresh();
		});

	const body = !data ? (
		<div className="oa-view">{error ? null : <p className="oa-dim">Loading…</p>}</div>
	) : page === "overview" ? (
		<OverviewScreen project={project} report={data.report} engines={engines} onNavigate={navigate} onRun={() => act(() => api.startRun(id))} onCancel={() => act(async () => (data.report.run ? api.cancelRun(data.report.run.id) : undefined))} />
	) : page === "prompts" ? (
		<PromptsScreen
			brand={project.name}
			prompts={data.prompts}
			stats={data.stats}
			suggestions={suggestions}
			suggesting={suggesting}
			onAdd={async (texts) => {
				await api.addPrompts(id, texts);
				await refresh();
			}}
			onToggle={(promptId, active) => act(() => api.setPromptActive(promptId, active))}
			onRemove={(promptId) => act(() => api.removePrompt(promptId))}
			onDismissSuggestions={() => setSuggestions(null)}
			onSuggest={() => {
				setSuggesting(true);
				void guard(async () => setSuggestions(await api.suggest(id))).finally(() => setSuggesting(false));
			}}
			onOpen={(text) => {
				setAnswerFilter(text);
				navigate("answers");
			}}
		/>
	) : page === "answers" ? (
		<AnswersScreen answers={data.answers} project={project} competitors={data.competitors.flatMap((c) => [c.name, ...c.aliases])} engines={engines} filter={answerFilter} onFilter={setAnswerFilter} />
	) : page === "sources" ? (
		<SourcesScreen report={data.report} />
	) : page === "competitors" ? (
		<CompetitorsScreen key={data.competitors.map((c) => c.name).join("|")} report={data.report} competitors={data.competitors} onSave={(next) => act(() => api.saveCompetitors(id, next))} />
	) : page === "audit" ? (
		<AuditScreen
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
	) : (
		<SettingsScreen
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
	);

	return shell(
		<>
			{error ? (
				<p className="oa-alert" role="alert" style={{ margin: "12px 32px 0" }}>
					{error}
				</p>
			) : null}
			{body}
		</>,
		PAGES.find((p) => p.id === page)?.label ?? "Overview",
	);
}
