import type { PageId } from "@api";
import { useEffect, useState } from "react";
import { Toaster, toast } from "@/components/ui/toaster-clean";
import { api } from "./api";
import { FirstRun } from "./app/first-run";
import { NAV, pageFromHash } from "./app/pages";
import { Screen } from "./app/screens";
import { Shell } from "./app/shell";
import { useAsk } from "./app/use-ask";
import { useCompetitorIdeas } from "./app/use-competitor-ideas";
import { useSetup } from "./app/use-setup";
import { useSuggestions } from "./app/use-suggestions";
import { messageOf, useWorkspace } from "./app/use-workspace";
import { OnboardingFlow } from "./screens/onboarding";

const BRIEF_COPIED = "Paste it into Claude Code or Codex in your website's code.";

export function App() {
	const workspace = useWorkspace();
	const { projects, project, data, engines, guard, loadProject, loadState } = workspace;
	const projectId = project?.id ?? null;
	const [page, setPage] = useState<PageId>(pageFromHash);
	const [creating, setCreating] = useState(false);
	const [busy, setBusy] = useState(false);
	const [answerFilter, setAnswerFilter] = useState("");
	const suggestions = useSuggestions(projectId, workspace);
	const rivals = useCompetitorIdeas(page, workspace);
	const chat = useAsk(projectId);
	const { setup, begin: beginSetup, finish: finishSetup } = useSetup(loadProject);

	useEffect(() => {
		const onHash = () => setPage(pageFromHash());
		window.addEventListener("hashchange", onHash);
		return () => window.removeEventListener("hashchange", onHash);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: the filter belongs to one brand, so it clears when it changes
	useEffect(() => {
		setAnswerFilter("");
	}, [projectId]);

	useEffect(() => {
		if (data && !window.location.hash && !data.report.run) setPage("prompts");
	}, [data]);

	const navigate = (next: PageId) => {
		window.location.hash = next;
		setPage(next);
		workspace.clearError();
	};
	const openBrand = (id: string) => {
		setCreating(false);
		workspace.select(id);
	};

	if (projects === null)
		return (
			<Shell
				projects={[]}
				project={null}
				page={null}
				onPage={navigate}
				onBrand={openBrand}
				onNewBrand={() => setCreating(true)}
				onCommand={() => {}}
			>
				<div className="ui-as-page">{workspace.error ? <p className="ui-as-page-sub">{workspace.error}</p> : null}</div>
			</Shell>
		);

	if (setup && project && setup.id === project.id && !creating)
		return (
			<>
				<FirstRun
					setup={setup}
					project={project}
					data={data}
					engines={engines}
					onOpen={() => {
						finishSetup();
						navigate("overview");
					}}
				/>
				<Toaster position="bottom-right" />
			</>
		);

	if (!project || creating)
		return (
			<>
				<OnboardingFlow
					engines={engines}
					nav={NAV}
					busy={busy}
					onCancel={project ? () => setCreating(false) : undefined}
					onFindCompetitors={
						workspace.engineReady
							? async (name, domain, location) => (await api.competitorIdeasFor(name, domain, location)).competitors
							: undefined
					}
					onCreate={(input) => {
						setBusy(true);
						void guard(async () => {
							const created = await api.createProject(input);
							await loadState();
							workspace.select(created.project.id);
							setCreating(false);
							navigate("overview");
							void beginSetup(created.project.id);
						}).finally(() => setBusy(false));
					}}
					onSaveKey={async (engineId, key) => {
						try {
							await api.saveSettings({ [`${engineId}.apiKey`]: key });
							await loadState();
						} catch (caught) {
							toast.error("That key was not saved", { description: messageOf(caught) });
						}
					}}
				/>
				<Toaster position="bottom-right" />
			</>
		);

	const id = project.id;
	const act = (work: () => Promise<unknown>) =>
		void guard(async () => {
			await work();
			await loadProject(id);
		});
	const startRun = () =>
		act(async () => {
			await api.startRun(id);
			toast("Run started", { description: "Each engine is being asked every active question." });
		});
	const cancelRun = () => act(async () => (data?.report.run ? api.cancelRun(data.report.run.id) : undefined));
	const trackQuestion = (text: string) =>
		act(async () => {
			await api.addPrompts(id, [text]);
			toast.success("Question tracked", { description: "Press Run now to ask the AI engines." });
		});
	const copyBrief = () => {
		const audit = data?.audit.audit;
		if (audit?.status !== "done") {
			navigate("audit");
			toast("Run an audit first", { description: "The fix brief is built from its findings." });
			return;
		}
		void guard(async () => {
			await navigator.clipboard.writeText(await api.auditBrief(audit.id));
			toast.success("Fix brief copied", { description: BRIEF_COPIED });
		});
	};

	const runCommand = (command: string, text?: string) => {
		if (command === "run") startRun();
		else if (command === "audit") navigate("audit");
		else if (command === "agent") navigate("settings");
		else if (command === "brief") copyBrief();
		else if (command === "new") setCreating(true);
		else if (command === "suggest") {
			navigate("prompts");
			suggestions.suggest(id);
		} else if (command === "ask" && text?.trim()) {
			trackQuestion(text.trim());
			navigate("prompts");
		}
	};

	return (
		<Shell
			projects={projects}
			project={project}
			page={page}
			onPage={(next) => {
				setCreating(false);
				navigate(next);
			}}
			onBrand={openBrand}
			onNewBrand={() => setCreating(true)}
			onCommand={runCommand}
		>
			<Screen
				page={page}
				context={{
					workspace,
					project,
					data,
					suggestions,
					rivals,
					chat,
					answerFilter,
					setAnswerFilter,
					navigate,
					act,
					startRun,
					cancelRun,
					copyBrief,
					trackQuestion,
				}}
			/>
			<Toaster position="bottom-right" />
		</Shell>
	);
}
