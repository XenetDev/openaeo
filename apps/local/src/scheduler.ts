import { type Log, logError } from "./log";
import { RunError, type RunService } from "./runs";
import type { Store } from "./store/store";

const DAY = 24 * 60 * 60 * 1000;
const PERIODS: Record<string, number> = { daily: DAY, weekly: 7 * DAY };

export function createScheduler(deps: {
	store: Store;
	runs: RunService;
	now?: () => number;
	intervalMs?: number;
	log?: Log;
}) {
	const now = deps.now ?? Date.now;
	const log = deps.log ?? logError;
	let timer: ReturnType<typeof setInterval> | null = null;

	function tick(): string[] {
		const period = PERIODS[deps.store.settings.get("schedule") ?? "off"];
		if (!period) return [];
		const started: string[] = [];
		for (const project of deps.store.projects.list()) {
			try {
				const latest = deps.store.runs.latest(project.id);
				if (!latest || latest.status === "running" || now() - latest.startedAt < period) continue;
				started.push(deps.runs.start(project.id).id);
			} catch (error) {
				if (!(error instanceof RunError)) log(`scheduled run for ${project.id}`, error);
			}
		}
		return started;
	}

	return {
		tick,
		start() {
			timer ??= setInterval(tick, deps.intervalMs ?? 60_000);
		},
		stop() {
			if (timer) clearInterval(timer);
			timer = null;
		},
	};
}
