import { useCallback, useState } from "react";
import { api } from "../api";

export type Setup = {
	id: string;
	audit: "working" | "skipped";
	questions: "waiting" | "working" | "done" | "skipped";
	run: "waiting" | "working" | "skipped";
	count: number;
};

const FIRST_QUESTIONS = 8;

export function useSetup(loadProject: (id: string) => Promise<void>) {
	const [setup, setSetup] = useState<Setup | null>(null);

	const begin = useCallback(
		async (id: string) => {
			setSetup({ id, audit: "working", questions: "working", run: "waiting", count: 0 });
			const patch = (next: Partial<Setup>) => setSetup((now) => (now && now.id === id ? { ...now, ...next } : now));
			api.startAudit(id, "").then(
				() => loadProject(id),
				() => patch({ audit: "skipped" }),
			);
			let picks: string[] = [];
			try {
				picks = (await api.suggest(id)).prompts.slice(0, FIRST_QUESTIONS);
				if (picks.length) await api.addPrompts(id, picks);
			} catch {
				picks = [];
			}
			if (picks.length === 0) return patch({ questions: "skipped", run: "skipped" });
			patch({ questions: "done", count: picks.length, run: "working" });
			try {
				await api.startRun(id);
			} catch {
				patch({ run: "skipped" });
			}
			await loadProject(id).catch(() => {});
		},
		[loadProject],
	);

	return { setup, begin, finish: useCallback(() => setSetup(null), []) };
}
