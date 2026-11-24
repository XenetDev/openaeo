import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Turn } from "../screens/ask";
import { messageOf } from "./use-workspace";

const HISTORY_TURNS = 8;

export function useAsk(projectId: string | null) {
	const [turns, setTurns] = useState<Turn[]>([]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: a conversation belongs to one brand, so it clears when it changes
	useEffect(() => {
		setTurns([]);
	}, [projectId]);

	const settle = (id: string, next: Partial<Turn>) =>
		setTurns((now) => now.map((turn) => (turn.id === id ? { ...turn, ...next, pending: false } : turn)));

	const ask = (id: string, question: string, engine: string) => {
		if (turns.some((turn) => turn.pending)) return;
		const kept = turns.filter((turn) => !turn.failed);
		if (kept[kept.length - 1]?.role === "user") kept.pop();
		const history = kept.slice(-HISTORY_TURNS).map((turn) => ({ role: turn.role, text: turn.text }));
		const reply = crypto.randomUUID();
		setTurns([
			...kept,
			{ id: crypto.randomUUID(), role: "user", text: question },
			{ id: reply, role: "assistant", text: "", engine, pending: true },
		]);
		const asked = Date.now();
		api.ask(id, { question, history, engine: engine || undefined }).then(
			(result) =>
				settle(reply, {
					text: result.text,
					engine: result.engine,
					actions: result.actions,
					took: Math.round((Date.now() - asked) / 100) / 10,
				}),
			(caught) => settle(reply, { text: messageOf(caught), failed: true }),
		);
	};

	return { turns, ask, clear: useCallback(() => setTurns([]), []) };
}
