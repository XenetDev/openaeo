import type { EngineView, ProjectView } from "@api";
import { Mark } from "@/components/mark";
import { SetupPreview } from "../screens/onboarding";
import { FirstRunStep } from "../screens/onboarding-steps";
import { NAV } from "./pages";
import type { Setup } from "./use-setup";
import type { ProjectData } from "./use-workspace";

const ANSWERS_PER_MINUTE = 4;

type Props = {
	setup: Setup;
	project: ProjectView;
	data: ProjectData | null;
	engines: EngineView[];
	onOpen: () => void;
};

export function FirstRun({ setup, project, data, engines, onOpen }: Props) {
	const audit = data?.audit.audit;
	const run = data?.report.run;
	const ready = engines.filter((engine) => engine.available && engine.enabled);

	const auditState = setup.audit === "skipped" ? "skipped" : audit && audit.status !== "running" ? "done" : "working";
	const runState =
		setup.run === "skipped" || setup.run === "waiting"
			? setup.run
			: run && run.status !== "running"
				? "done"
				: "working";
	const finished =
		(runState === "done" || runState === "skipped") && auditState !== "working" && setup.questions !== "working";

	const auditDetail =
		auditState === "done" && audit
			? `${audit.pages.length} pages read, score ${audit.score ?? 0} of 100`
			: auditState === "skipped"
				? "Skipped. Run it later from the Audit page."
				: undefined;
	const questionsDetail =
		setup.questions === "done"
			? `${setup.count} questions tracked`
			: setup.questions === "skipped"
				? "None could be written. Add your own on the Prompts page."
				: undefined;
	const minutes = Math.max(1, Math.ceil((8 * Math.max(1, ready.length)) / ANSWERS_PER_MINUTE));
	const runDetail =
		runState === "working" && run
			? `${run.completed} of ${run.total} answers so far`
			: runState === "done" && run
				? `${run.completed} answers collected`
				: runState === "skipped"
					? "Skipped. Press Run now once you have questions."
					: `About ${minutes} minutes`;

	return (
		<FirstRunStep
			frame={{ product: "OpenAEO", email: "Runs on this computer", steps: 5, logo: <Mark size={20} /> }}
			step={5}
			brand={project.name}
			finished={finished}
			preview={
				<SetupPreview
					brand={project.name}
					domains={project.domains}
					competitors={data?.competitors.map((c) => c.name) ?? []}
					engines={engines}
					nav={NAV}
				/>
			}
			tasks={[
				{
					id: "audit",
					label: "Checking whether AI can read your website",
					state: auditState,
					detail: auditDetail,
				},
				{
					id: "questions",
					label: "Writing the questions your buyers ask",
					state: setup.questions,
					detail: questionsDetail,
				},
				{
					id: "run",
					label: `Asking ${ready.map((engine) => engine.label).join(" and ") || "your engines"}`,
					state: runState,
					detail: runDetail,
				},
			]}
			onOpen={onOpen}
		/>
	);
}
