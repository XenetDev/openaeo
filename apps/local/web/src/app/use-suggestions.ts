import type { Suggestions } from "@api";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Workspace } from "./use-workspace";

export function useSuggestions(projectId: string | null, { guard, isCurrent }: Pick<Workspace, "guard" | "isCurrent">) {
	const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
	const [suggesting, setSuggesting] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: suggestions belong to one brand, so they clear when it changes
	useEffect(() => {
		setSuggestions(null);
		setSuggesting(false);
	}, [projectId]);

	const suggest = useCallback(
		(id: string) => {
			setSuggesting(true);
			void guard(async () => {
				const result = await api.suggest(id);
				if (isCurrent(id)) setSuggestions(result);
			}).finally(() => isCurrent(id) && setSuggesting(false));
		},
		[guard, isCurrent],
	);

	return { suggestions, suggesting, suggest, dismiss: useCallback(() => setSuggestions(null), []) };
}
