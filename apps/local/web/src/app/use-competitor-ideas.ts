import type { CompetitorIdea, PageId } from "@api";
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/toaster-clean";
import { api } from "../api";
import { messageOf, type Workspace } from "./use-workspace";

export function useCompetitorIdeas(page: PageId, { project, data, engineReady, isCurrent }: Workspace) {
	const [ideas, setIdeas] = useState<CompetitorIdea[] | null>(null);
	const [finding, setFinding] = useState(false);
	const projectId = project?.id ?? null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: ideas belong to one brand, so they clear when it changes
	useEffect(() => {
		setIdeas(null);
		setFinding(false);
	}, [projectId]);

	const find = useCallback(
		(id: string, announce: boolean) => {
			setFinding(true);
			api
				.competitorIdeas(id)
				.then((result) => {
					if (!isCurrent(id)) return;
					setIdeas(result.competitors);
					if (announce && result.competitors.length > 0)
						toast(`Found ${result.competitors.length} likely competitors`, {
							description: "Open Competitors to choose the ones to track.",
						});
				})
				.catch((caught) => {
					if (!announce) toast.error("That didn't work", { description: messageOf(caught) });
				})
				.finally(() => isCurrent(id) && setFinding(false));
		},
		[isCurrent],
	);

	const noRivals = data ? data.competitors.length === 0 : false;
	const worthLooking =
		data?.report.run?.status === "done" || data?.audit.audit?.status === "done" || page === "competitors";
	useEffect(() => {
		if (!projectId || !noRivals || !engineReady || finding || ideas !== null || !worthLooking) return;
		const key = `openaeo.ideas.${projectId}`;
		if (window.localStorage.getItem(key)) return;
		window.localStorage.setItem(key, "1");
		find(projectId, page !== "competitors");
	}, [projectId, noRivals, engineReady, finding, ideas, worthLooking, page, find]);

	return { ideas, finding, find, dismiss: useCallback(() => setIdeas(null), []) };
}
