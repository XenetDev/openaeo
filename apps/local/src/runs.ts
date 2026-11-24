import { match, type Provider, run as runEngine } from "@openaeo/engine";
import { runBrandCheck } from "./brand-check";
import { type Log, logError } from "./log";
import { labelSentiment } from "./sentiment";
import type { Run, Store } from "./store/store";

export type RunErrorCode = "already_running" | "no_prompts" | "no_engines" | "not_found";

export class RunError extends Error {
	readonly code: RunErrorCode;

	constructor(code: RunErrorCode, message: string) {
		super(message);
		this.name = "RunError";
		this.code = code;
	}
}

export type RunServiceDeps = {
	store: Store;
	providers: () => Provider[];
	concurrency?: number;
	retries?: number;
	sentiment?: boolean;
	brandCheck?: boolean;
	log?: Log;
};

export function createRunService(deps: RunServiceDeps) {
	const { store } = deps;
	const log = deps.log ?? logError;
	const active = new Map<string, { controller: AbortController; done: Promise<Run> }>();

	async function execute(created: Run, providers: Provider[], controller: AbortController): Promise<Run> {
		const runId = created.id;
		const projectId = created.projectId;
		let failed = false;
		try {
			const project = store.projects.get(projectId);
			if (!project) throw new Error("Project was removed.");
			const competitors = store.competitors.list(projectId);
			const prompts = store.prompts.list(projectId).filter((p) => p.active);
			const idByText = new Map(prompts.map((p) => [p.text, p.id]));
			const items = runEngine({
				prompts: prompts.map((p) => p.text),
				providers,
				concurrency: deps.concurrency,
				retries: deps.retries,
				signal: controller.signal,
			});
			for await (const item of items) {
				const matched = item.ok ? match(item.answer, project, competitors) : null;
				store.answers.save(runId, idByText.get(item.prompt) ?? "", item, matched);
				store.runs.increment(runId);
			}
			const judge = providers[0];
			if (deps.sentiment && judge && !controller.signal.aborted) {
				const mentioned = store.answers.listByRun(runId).filter((a) => a.errorCode === null && a.brandRank !== null);
				const labels = await labelSentiment(judge, project.name, mentioned, { signal: controller.signal, log });
				for (const [id, label] of labels) store.answers.setSentiment(id, label);
			}
			if (deps.brandCheck && judge && !controller.signal.aborted) {
				const checks = await runBrandCheck({ providers, judge, project, signal: controller.signal, log });
				if (!controller.signal.aborted) store.brandChecks.save(runId, projectId, checks);
			}
		} catch (error) {
			if (!controller.signal.aborted) log(`run ${runId}`, error);
			failed = true;
			controller.abort();
		}
		let finished: Run | null = null;
		try {
			finished = store.runs.finish(runId, failed || controller.signal.aborted ? "interrupted" : "done");
		} catch (error) {
			log(`finishing run ${runId}`, error);
		}
		active.delete(runId);
		return finished ?? { ...created, status: "interrupted", finishedAt: Date.now() };
	}

	return {
		start(projectId: string): Run {
			if (!store.projects.get(projectId)) throw new RunError("not_found", "That project does not exist.");
			if (store.runs.active(projectId))
				throw new RunError("already_running", "A run is already in progress for this project.");
			const prompts = store.prompts.list(projectId).filter((p) => p.active);
			if (prompts.length === 0) throw new RunError("no_prompts", "Add at least one active prompt before running.");
			const providers = deps.providers();
			if (providers.length === 0) {
				throw new RunError(
					"no_engines",
					"No AI engine is available. Install and log in to Claude Code or Codex, or add an API key in Settings.",
				);
			}
			const created = store.runs.create(projectId, prompts.length * providers.length);
			const controller = new AbortController();
			active.set(created.id, { controller, done: execute(created, providers, controller) });
			return created;
		},
		cancel(runId: string): void {
			active.get(runId)?.controller.abort();
		},
		cancelAll(): void {
			for (const entry of active.values()) entry.controller.abort();
		},
		async wait(runId: string): Promise<Run> {
			const entry = active.get(runId);
			if (entry) return entry.done;
			const stored = store.runs.get(runId);
			if (!stored) throw new RunError("not_found", "That run does not exist.");
			return stored;
		},
	};
}

export type RunService = ReturnType<typeof createRunService>;
