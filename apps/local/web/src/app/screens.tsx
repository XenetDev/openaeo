import type { PageId, ProjectView, ReportView } from "@api";
import type { ReactNode } from "react";
import { toast } from "@/components/ui/toaster-clean";
import { api } from "../api";
import { HOST_POSTS } from "../host";
import { AnswersScreen } from "../screens/answers";
import { AskScreen } from "../screens/ask";
import { AuditScreen } from "../screens/audit";
import { CompetitorsScreen, SourcesScreen } from "../screens/lists";
import { LoadingScreen } from "../screens/loading";
import { OpportunitiesScreen } from "../screens/opportunities";
import { OverviewScreen } from "../screens/overview";
import { PlanScreen } from "../screens/plan";
import { PromptsScreen } from "../screens/prompts";
import { RunsScreen } from "../screens/runs";
import { SettingsScreen } from "../screens/settings";
import { TagFilter } from "../screens/shared";
import { isPage } from "./pages";
import type { useAsk } from "./use-ask";
import type { useCompetitorIdeas } from "./use-competitor-ideas";
import type { useSuggestions } from "./use-suggestions";
import { messageOf, type ProjectData, type Workspace } from "./use-workspace";

const EMPTY_REPORT: ReportView = {
	run: null,
	basedOnRunId: null,
	overall: {
		metrics: { answers: 0, mentionRate: 0, averageRank: null, rankScore: 0, shareOfVoice: 0, citationRate: 0 },
		visibility: 0,
		sentiment: { score: null, positive: 0, neutral: 0, negative: 0 },
	},
	engines: [],
	competitors: [],
	topDomains: [],
	trend: [],
	problems: [],
	brand: [],
};

type CsvFile = { name: string; blob: Blob };

const exportCsv = (workspace: Workspace, load: () => Promise<CsvFile>, done: string) =>
	void workspace.guard(async () => {
		const file = await load();
		const url = URL.createObjectURL(file.blob);
		const link = Object.assign(document.createElement("a"), { href: url, download: file.name });
		link.click();
		URL.revokeObjectURL(url);
		toast.success(done, { description: file.name });
	});

export type ScreenContext = {
	workspace: Workspace;
	project: ProjectView;
	data: ProjectData | null;
	suggestions: ReturnType<typeof useSuggestions>;
	rivals: ReturnType<typeof useCompetitorIdeas>;
	chat: ReturnType<typeof useAsk>;
	answerFilter: string;
	setAnswerFilter: (text: string) => void;
	navigate: (page: PageId) => void;
	act: (work: () => Promise<unknown>) => void;
	startRun: () => void;
	cancelRun: () => void;
	copyBrief: () => void;
	trackQuestion: (text: string) => void;
};

type Loaded = ScreenContext & { data: ProjectData };

const tagFilter = ({ tags, tag, setTag }: Workspace) => <TagFilter tags={tags} tag={tag} onTag={setTag} />;

const SCREENS: Record<Exclude<PageId, "overview">, (context: Loaded) => ReactNode> = {
	plan: ({ workspace, project, data, chat, navigate }) => (
		<PlanScreen
			project={project}
			plan={data.plan}
			hasRun={data.report.run !== null}
			onDone={(step, done) =>
				void workspace.guard(async () => {
					await api.setPlanStep(project.id, step, done);
					await workspace.loadProject(project.id);
				})
			}
			onAsk={(question) => {
				chat.ask(project.id, question, "");
				navigate("ask");
			}}
			onNavigate={navigate}
		/>
	),
	prompts: ({ workspace, project, data, suggestions, act, navigate, setAnswerFilter }) => (
		<PromptsScreen
			brand={project.name}
			prompts={data.prompts}
			stats={data.stats}
			suggestions={suggestions.suggestions}
			suggesting={suggestions.suggesting}
			onAdd={async (texts) => {
				try {
					await api.addPrompts(project.id, texts);
					await workspace.loadProject(project.id);
					toast.success(texts.length === 1 ? "Question tracked" : `${texts.length} questions tracked`, {
						description: "Press Run now to ask the AI engines.",
					});
				} catch (caught) {
					toast.error("That question was not tracked", { description: messageOf(caught) });
					throw caught;
				}
			}}
			onToggle={(promptId, active) => act(() => api.setPromptActive(promptId, active))}
			onRemove={(promptId) => act(() => api.removePrompt(promptId))}
			tag={workspace.tag}
			filter={tagFilter(workspace)}
			onTags={(promptId, tags) =>
				act(async () => {
					await api.setPromptTags(promptId, tags);
					toast.success("Tags saved");
				})
			}
			onDismissSuggestions={suggestions.dismiss}
			onSuggest={() => suggestions.suggest(project.id)}
			onExport={() => exportCsv(workspace, () => api.exportQuestions(project.id), "Questions exported")}
			onOpen={(text) => {
				setAnswerFilter(text);
				navigate("answers");
			}}
		/>
	),
	answers: ({ workspace, project, data, answerFilter, setAnswerFilter, startRun, navigate }) => (
		<AnswersScreen
			answers={data.answers}
			prompts={data.prompts}
			report={data.report}
			tag={workspace.tag}
			tagControl={tagFilter(workspace)}
			project={project}
			engines={workspace.engines}
			live={data.report.run?.status === "running"}
			filter={answerFilter}
			onFilter={setAnswerFilter}
			onRunAgain={startRun}
			onNavigate={navigate}
			onExport={() => exportCsv(workspace, () => api.exportAnswers(project.id), "Answers exported")}
		/>
	),
	sources: ({ workspace, project, data }) => (
		<SourcesScreen project={project} report={data.report} filter={tagFilter(workspace)} />
	),
	competitors: ({ workspace, project, data, rivals, act }) => (
		<CompetitorsScreen
			key={data.competitors.map((c) => c.name).join("|")}
			project={project}
			report={data.report}
			competitors={data.competitors}
			filter={tagFilter(workspace)}
			onSave={(next) =>
				act(async () => {
					await api.saveCompetitors(project.id, next);
					toast.success("Competitors saved", { description: "They apply from the next run." });
				})
			}
			ideas={rivals.ideas}
			finding={rivals.finding}
			canFind={workspace.engineReady}
			onDismissIdeas={rivals.dismiss}
			onFind={() => rivals.find(project.id, false)}
		/>
	),
	opportunities: ({ workspace, project, data, navigate, setAnswerFilter }) => (
		<OpportunitiesScreen
			project={project}
			engines={workspace.engines}
			found={data.found}
			onNavigate={navigate}
			onOpenQuestion={(text) => {
				setAnswerFilter(text);
				navigate("answers");
			}}
		/>
	),
	audit: ({ project, data, act, copyBrief, navigate }) => {
		const audit = data.audit.audit;
		return (
			<AuditScreen
				key={`${project.id}:${audit?.id ?? "none"}`}
				project={project}
				audit={audit}
				findings={data.audit.findings}
				artefacts={data.audit.artefacts}
				defaultUrl={audit?.origin ?? project.domains[0] ?? ""}
				onRun={(url) => act(() => api.startAudit(project.id, url))}
				onCancel={() => act(async () => (audit ? api.cancelAudit(audit.id) : undefined))}
				onCopyBrief={copyBrief}
				flagged={data.plan.steps.filter((step) => !step.done && step.id !== "website")}
				onPlan={() => navigate("plan")}
			/>
		);
	},
	runs: ({ workspace, project, data, startRun, cancelRun, navigate }) => (
		<RunsScreen
			project={project}
			engines={workspace.engines}
			report={data.report}
			schedule={workspace.settings.schedule ?? "off"}
			onSchedule={(value, label) =>
				void workspace.guard(async () => {
					await api.saveSettings({ schedule: value });
					await workspace.loadState();
					toast.success(`Schedule: ${label.toLowerCase()}`);
				})
			}
			onStart={startRun}
			onCancel={cancelRun}
			onOpenAnswers={() => navigate("answers")}
		/>
	),
	ask: ({ workspace, project, chat, startRun, navigate, trackQuestion }) => (
		<AskScreen
			project={project}
			engines={workspace.engines}
			turns={chat.turns}
			onClear={chat.clear}
			onAction={(action) => {
				if (action.type === "run") startRun();
				else if (action.type === "audit") navigate("audit");
				else if (action.type === "open") navigate(isPage(action.page) ? action.page : "overview");
				else trackQuestion(action.question);
			}}
			onAsk={(question, engine) => chat.ask(project.id, question, engine)}
		/>
	),
	posts: ({ project }) => HOST_POSTS?.(project) ?? null,
	settings: ({ workspace, project, navigate }) => (
		<SettingsScreen
			key={project.id}
			engines={workspace.engines}
			settings={workspace.settings}
			project={project}
			onSave={(next, message) =>
				void workspace.guard(async () => {
					await api.saveSettings(next);
					await workspace.loadState();
					toast.success(message);
				})
			}
			onSaveProject={(next, message) =>
				void workspace.guard(async () => {
					await api.updateProject(project.id, next);
					await workspace.loadState();
					await workspace.loadProject(project.id);
					toast.success(message);
				})
			}
			onDeleteProject={() =>
				void workspace.guard(async () => {
					await api.deleteProject(project.id);
					workspace.forget();
					await workspace.loadState();
					navigate("overview");
					toast(`${project.name} deleted`);
				})
			}
		/>
	),
};

export function Screen({ page, context }: { page: PageId; context: ScreenContext }) {
	const { workspace, project, data } = context;
	if (page === "overview")
		return (
			<OverviewScreen
				project={project}
				report={data?.report ?? EMPTY_REPORT}
				engines={workspace.engines}
				loading={!data}
				plan={data?.plan ?? null}
				filter={tagFilter(workspace)}
				onNavigate={context.navigate}
				onRun={context.startRun}
				onCancel={context.cancelRun}
			/>
		);
	if (!data) return <LoadingScreen brand={project.name} page={page} />;
	return SCREENS[page]({ ...context, data });
}
