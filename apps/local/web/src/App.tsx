import type { AnswerView, ArtefactsView, AuditView, EngineInfo, EntityView, FindingView, PageId, ProjectView, PromptView, ReportView, Suggestions } from "@openaeo/ui";
import { AiChat02Icon, BubbleChatIcon, CheckListIcon, Clock01Icon, ComputerIcon, DashboardSquare01Icon, Globe02Icon, Moon02Icon, News01Icon, PaintBoardIcon, Plug01Icon, PlusSignIcon, Search01Icon, Settings01Icon, Sun03Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, Icon, type ShellNavItem } from "@/components/app-shell";
import { AgentMark, AuditMark, BrandMark, BriefMark, RunMark, SuggestMark } from "./screens/command-icons";
import { saveTheme, storedTheme, type Theme } from "./theme";
import { ApiError, api } from "./api";
import { AnswersScreen } from "./screens/answers";
import { AuditScreen } from "./screens/audit";
import { CompetitorsScreen, SourcesScreen } from "./screens/lists";
import { AskScreen, type Turn } from "./screens/ask";
import { RunsScreen } from "./screens/runs";
import { OverviewScreen } from "./screens/overview";
import { type PromptStat, PromptsScreen } from "./screens/prompts";
import { OnboardingFlow } from "./screens/onboarding";
import { SettingsScreen } from "./screens/settings";
import { Toaster, toast } from "@/components/ui/toaster-clean";

const PAGES: { id: PageId; label: string; icon: ShellNavItem["icon"] }[] = [
	{ id: "overview", label: "Overview", icon: DashboardSquare01Icon },
	{ id: "prompts", label: "Prompts", icon: Search01Icon },
	{ id: "answers", label: "Answers", icon: BubbleChatIcon },
	{ id: "sources", label: "Sources", icon: News01Icon },
	{ id: "competitors", label: "Competitors", icon: UserMultipleIcon },
	{ id: "audit", label: "Audit", icon: CheckListIcon },
	{ id: "runs", label: "Runs", icon: Clock01Icon },
	{ id: "ask", label: "Ask Aeo", icon: AiChat02Icon },
	{ id: "settings", label: "Settings", icon: Settings01Icon },
];
const NAV = PAGES.filter((p) => p.id !== "settings");
const NEW_BRAND = "Track another brand";
const pageFromHash = (): PageId => PAGES.find((p) => p.id === window.location.hash.slice(1))?.id ?? "overview";
const EMPTY_REPORT: ReportView = {
	run: null,
	overall: { metrics: { answers: 0, mentionRate: 0, averageRank: null, rankScore: 0, shareOfVoice: 0, citationRate: 0 }, visibility: 0 },
	engines: [],
	competitors: [],
	topDomains: [],
	trend: [],
};
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
	const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
	const [suggesting, setSuggesting] = useState(false);
	const [answerFilter, setAnswerFilter] = useState("");
	const [turns, setTurns] = useState<Turn[]>([]);
	const [theme, setTheme] = useState<Theme>(storedTheme);
	const commandRef = useRef<(id: string, text?: string) => void>(() => {});
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
		if (!window.location.hash && !report.run) setPage("prompts");
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
		const onHash = () => setPage(pageFromHash());
		window.addEventListener("hashchange", onHash);
		return () => window.removeEventListener("hashchange", onHash);
	}, []);

	useEffect(() => {
		setData(null);
		setSuggestions(null);
		setAnswerFilter("");
		setTurns([]);
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
			nav={project ? NAV.map((p) => ({ label: p.label, icon: p.icon })) : []}
			groups={
				projects && projects.length > 0
					? [{ label: "Brands", items: [...projects.map((p) => ({ label: p.name, icon: Globe02Icon })), { label: NEW_BRAND, icon: PlusSignIcon }] }]
					: []
			}
			sideCards={false}
			workspaceItems={[
				...(projects ?? []).map((p) => ({ label: p.name, description: p.domains[0], checked: p.id === project?.id, onSelect: () => (setCreating(false), select(p.id)) })),
				{ label: NEW_BRAND, icon: PlusSignIcon, divider: true, onSelect: () => setCreating(true) },
				...(project ? [{ label: "Brand settings", icon: Settings01Icon, onSelect: () => navigate("settings") }] : []),
			]}
			accountItems={[
				{
					label: "Appearance",
					icon: PaintBoardIcon,
					submenu: (
						[
							["System", ComputerIcon],
							["Light", Sun03Icon],
							["Dark", Moon02Icon],
						] as const
					).map(([mode, icon]) => ({
						label: mode,
						icon,
						checked: mode === theme,
						onSelect: () => {
							saveTheme(mode);
							setTheme(mode);
						},
					})),
				},
				...(project
					? [
							{ label: "Connect your AI agent", icon: Plug01Icon, onSelect: () => navigate("settings") },
							{ label: "Settings", icon: Settings01Icon, onSelect: () => navigate("settings") },
						]
					: []),
			]}
			commands={
				project
					? [
							{
								id: "suggestions",
								label: "Suggestions",
								commands: [
									{ id: "run", label: "Run now", hint: "Ask every engine your questions", logo: <RunMark />, keywords: "start ask engines" },
									{ id: "audit", label: "Audit your website", hint: "Check what AI engines can read", logo: <AuditMark />, keywords: "check site crawl robots" },
									{ id: "suggest", label: "Suggest questions", hint: "Ideas from your AI engine", logo: <SuggestMark />, keywords: "prompts ideas" },
									{ id: "brief", label: "Copy fix brief", hint: "For Claude Code or Codex", logo: <BriefMark />, keywords: "agent fix findings" },
									{ id: "agent", label: "Connect your AI agent", hint: "Claude Code or Codex", logo: <AgentMark />, keywords: "mcp connect" },
								],
							},
							{ id: "brands", label: "Brands", commands: [{ id: "new", label: NEW_BRAND, hint: "Start tracking a new name", logo: <BrandMark />, keywords: "add project" }] },
						]
					: []
			}
			typedCommand={{ group: "Questions", label: (text) => `Track “${text}” as a question`, done: (text) => `Tracking “${text}”` }}
			onCommand={(id, text) => commandRef.current(id, text)}
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

	const nav = NAV.map((p) => ({ label: p.label, icon: p.icon }));

	if (projects === null) return shell(<div className="ui-as-page">{error ? <p className="ui-as-page-sub">{error}</p> : null}</div>, "");

	if (!project || creating) {
		return (
			<>
				<OnboardingFlow
					engines={engines}
					nav={nav}
					busy={busy}
					onCancel={project ? () => setCreating(false) : undefined}
					onCreate={(input) => {
						setBusy(true);
						void guard(async () => {
							const created = await api.createProject(input);
							await loadState();
							select(created.project.id);
							setCreating(false);
							navigate("prompts");
							toast.success(`${created.project.name} is set up`, { description: "Add the questions your buyers ask, then run them." });
						}).finally(() => setBusy(false));
					}}
				/>
				<Toaster position="bottom-right" />
			</>
		);
	}

	const id = project.id;
	const refresh = () => loadProject(id);
	const act = (work: () => Promise<unknown>) =>
		void guard(async () => {
			await work();
			await refresh();
		});

	commandRef.current = (command, text) => {
		if (command === "run") startRun();
		else if (command === "audit") navigate("audit");
		else if (command === "agent") navigate("settings");
		else if (command === "brief") {
			const audit = data?.audit.audit;
			if (!audit || audit.status !== "done") {
				navigate("audit");
				toast("Run an audit first", { description: "The fix brief is built from its findings." });
			} else {
				void guard(async () => {
					await navigator.clipboard.writeText(await api.auditBrief(audit.id));
					toast.success("Fix brief copied", { description: "Paste it into Claude Code or Codex in your website's code." });
				});
			}
		}
		else if (command === "new") setCreating(true);
		else if (command === "suggest") {
			navigate("prompts");
			setSuggesting(true);
			void guard(async () => setSuggestions(await api.suggest(id))).finally(() => setSuggesting(false));
		} else if (command === "ask" && text?.trim()) {
			act(async () => {
				await api.addPrompts(id, [text.trim()]);
				toast.success("Question tracked");
			});
			navigate("prompts");
		}
	};

	const startRun = () =>
		act(async () => {
			await api.startRun(id);
			toast("Run started", { description: "Each engine is being asked every active question." });
		});

	const body =
		page === "overview" ? (
			<OverviewScreen
				project={project}
				report={data?.report ?? EMPTY_REPORT}
				engines={engines}
				loading={!data}
				onNavigate={navigate}
				onRun={startRun}
				onCancel={() => act(async () => (data?.report.run ? api.cancelRun(data.report.run.id) : undefined))}
			/>
		) : !data ? (
			<div className="ui-as-page" />
		) : page === "prompts" ? (
			<PromptsScreen
				brand={project.name}
				prompts={data.prompts}
				stats={data.stats}
				suggestions={suggestions}
				suggesting={suggesting}
				onAdd={async (texts) => {
					try {
						await api.addPrompts(id, texts);
						await refresh();
						toast.success(texts.length === 1 ? "Question tracked" : `${texts.length} questions tracked`, { description: "Press Run now to ask the AI engines." });
					} catch (caught) {
						toast.error("That question was not tracked", { description: messageOf(caught) });
						throw caught;
					}
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
			<AnswersScreen answers={data.answers} project={project} engines={engines} live={data.report.run?.status === "running"} filter={answerFilter} onFilter={setAnswerFilter} onRunAgain={startRun} onNavigate={navigate} />
		) : page === "sources" ? (
			<SourcesScreen project={project} report={data.report} />
		) : page === "competitors" ? (
			<CompetitorsScreen
				key={data.competitors.map((c) => c.name).join("|")}
				project={project}
				report={data.report}
				competitors={data.competitors}
				onSave={(next) =>
					act(async () => {
						await api.saveCompetitors(id, next);
						toast.success("Competitors saved", { description: "They apply from the next run." });
					})
				}
			/>
		) : page === "audit" ? (
			<AuditScreen
				key={`${id}:${data.audit.audit?.id ?? "none"}`}
				project={project}
				audit={data.audit.audit}
				findings={data.audit.findings}
				artefacts={data.audit.artefacts}
				defaultUrl={data.audit.audit?.origin ?? project.domains[0] ?? ""}
				onRun={(url) => act(() => api.startAudit(id, url))}
				onCancel={() => act(async () => (data.audit.audit ? api.cancelAudit(data.audit.audit.id) : undefined))}
				onCopyBrief={() =>
					void guard(async () => {
						if (!data.audit.audit) return;
						await navigator.clipboard.writeText(await api.auditBrief(data.audit.audit.id));
						toast.success("Fix brief copied", { description: "Paste it into Claude Code or Codex in your website's code." });
					})
				}
			/>
		) : page === "ask" ? (
			<AskScreen
				project={project}
				engines={engines}
				turns={turns}
				onClear={() => setTurns([])}
				onAsk={(question, engine) => {
					if (turns.some((t) => t.pending)) return;
					const kept = turns.filter((t) => !t.failed);
					if (kept[kept.length - 1]?.role === "user") kept.pop();
					const history = kept.map((t) => ({ role: t.role, text: t.text }));
					const reply = crypto.randomUUID();
					setTurns([...kept, { id: crypto.randomUUID(), role: "user", text: question }, { id: reply, role: "assistant", text: "", engine, pending: true }]);
					const asked = Date.now();
					api.ask(id, { question, history, engine: engine || undefined }).then(
						(result) => setTurns((now) => now.map((t) => (t.id === reply ? { ...t, text: result.text, engine: result.engine, pending: false, took: Math.round((Date.now() - asked) / 100) / 10 } : t))),
						(caught) => setTurns((now) => now.map((t) => (t.id === reply ? { ...t, text: messageOf(caught), pending: false, failed: true } : t))),
					);
				}}
			/>
		) : page === "runs" ? (
			<RunsScreen
				project={project}
				engines={engines}
				report={data.report}
				schedule={settings.schedule ?? "off"}
				onSchedule={(value, label) =>
					void guard(async () => {
						await api.saveSettings({ schedule: value });
						await loadState();
						toast.success(`Schedule: ${label.toLowerCase()}`);
					})
				}
				onStart={startRun}
				onCancel={() => act(async () => (data.report.run ? api.cancelRun(data.report.run.id) : undefined))}
				onOpenAnswers={() => navigate("answers")}
			/>
		) : (
			<SettingsScreen
				key={id}
				engines={engines}
				settings={settings}
				project={project}
				onSave={(next, message) =>
					void guard(async () => {
						await api.saveSettings(next);
						await loadState();
						toast.success(message);
					})
				}
				onSaveProject={(next, message) =>
					void guard(async () => {
						await api.updateProject(id, next);
						await loadState();
						await refresh();
						toast.success(message);
					})
				}
				onDeleteProject={() =>
					void guard(async () => {
						await api.deleteProject(id);
						window.localStorage.removeItem("openaeo.project");
						setProjectId(null);
						await loadState();
						navigate("overview");
						toast(`${project.name} deleted`);
					})
				}
			/>
		);

	return shell(
		<>
			{body}
			<Toaster position="bottom-right" />
		</>,
		PAGES.find((p) => p.id === page)?.label ?? "Overview",
	);
}
