import type { RunService } from "./runs";
import type { Store } from "./store/store";

const DAY = 24 * 60 * 60 * 1000;
const PERIODS: Record<string, number> = { daily: DAY, weekly: 7 * DAY };

export function createScheduler(deps: { store: Store; runs: RunService; now?: () => number; intervalMs?: number }) {
	const now = deps.now ?? Date.now;
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
			} catch {}
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
