import type { PromptView, Suggestions } from "@openaeo/ui";
import { PromptExplorerScreen, type PexKeyword, type PexResult } from "@/components/prompt-explorer";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { EmptyState } from "@/components/app-shell";
import { Spinner } from "@/components/ui/spinner-clean";

export type PromptStat = {
	promptId: string;
	text: string;
	active: boolean;
	history: { runId: string; startedAt: number; rate: number }[];
	latest: number | null;
	previous: number | null;
	bestRank: number | null;
};

type Props = {
	brand: string;
	prompts: PromptView[];
	stats: PromptStat[];
	suggestions: Suggestions | null;
	suggesting: boolean;
	onAdd: (texts: string[]) => Promise<void>;
	onToggle: (id: string, active: boolean) => void;
	onRemove: (id: string) => void;
	onSuggest: () => void;
	onDismissSuggestions: () => void;
	onOpen: (text: string) => void;
};

const toKeyword = (s: PromptStat): PexKeyword => ({
	id: s.promptId,
	text: s.text,
	volume: (s.latest ?? 0) * 100,
	pending: s.latest === null,
	change: s.latest !== null && s.previous !== null ? (s.latest - s.previous) * 100 : 0,
	trend: s.history.map((h) => h.rate * 100),
});

export function PromptsScreen({ brand, prompts, stats, suggestions, suggesting, onAdd, onToggle, onRemove, onSuggest, onDismissSuggestions, onOpen }: Props) {
	const keywords = stats.filter((s) => s.active).map(toKeyword);
	const ranked = [...keywords].sort((a, b) => b.volume - a.volume);
	const tracked = new Set(prompts.map((p) => p.text.toLowerCase()));
	const fresh = suggestions?.prompts.filter((p) => !tracked.has(p.toLowerCase())) ?? [];
	const spot = useRef<HTMLDivElement>(null);
	const arrived = suggestions !== null;
	useEffect(() => {
		if (suggesting || arrived) spot.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [suggesting, arrived]);

	return (
			<PromptExplorerScreen
				workspace={brand}
				prompts={keywords}
				popular={ranked}
				rising={keywords.filter((k) => k.change > 0).sort((a, b) => b.change - a.change)}
				falling={keywords.filter((k) => k.change < 0).sort((a, b) => a.change - b.change)}
				empty={keywords.length === 0}
				onOpen={onOpen}
				onAnalyse={async (texts): Promise<PexResult[]> => {
					await onAdd(texts);
					return texts.map((text) => {
						const known = keywords.find((k) => k.text.toLowerCase() === text.toLowerCase());
						return { text, volume: known?.volume ?? 0, change: known?.change ?? 0, pending: known?.pending ?? true, trend: known?.trend ?? [], share: (known?.volume ?? 0) / 100 };
					});
				}}
				actions={
					<Button variant="ghost" size="sm" loading={suggesting} onClick={onSuggest}>
						Suggest questions
					</Button>
				}
				after={
<>
				<div ref={spot} />
				{suggesting ? (
					<Card>
						<CardHeader icon={<Spinner />} title={`Writing questions for ${brand}`} description="Your AI engine reads your website and the questions you already track. This takes about half a minute." />
					</Card>
				) : suggestions ? (
					<Card>
						<CardHeader
							title="Suggested questions"
							description={
								suggestions.fallback
									? "Generic starting points, because no AI engine could suggest better ones."
									: "Written by your AI engine from your website and the questions you already track. Keep the ones a real buyer would ask."
							}
							action={
								<span className="oa-inline">
									{fresh.length > 0 ? (
										<Button size="sm" onClick={() => void onAdd(fresh)}>
											Track all {fresh.length}
										</Button>
									) : null}
									<Button variant="ghost" size="sm" onClick={onDismissSuggestions}>
										Dismiss
									</Button>
								</span>
							}
						/>
						<CardContent>
							{fresh.length === 0 ? (
								<EmptyState bare icon={null} title="You already track all of these" text="Press Suggest questions again for a fresh set." />
							) : (
								<div className="oa-stack" style={{ gap: 4 }}>
									{fresh.map((text) => (
										<div key={text} className="oa-inline" style={{ flexWrap: "nowrap" }}>
											<span className="oa-grow">{text}</span>
											<Button variant="secondary" size="sm" onClick={() => void onAdd([text])}>
												Track
											</Button>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				) : null}

				{prompts.length > 0 ? (
					<Card>
						<CardHeader title="Manage questions" description="Paused questions are kept but not asked in runs." action={<Badge>{prompts.filter((p) => p.active).length} active</Badge>} />
						<CardContent>
							<div className="oa-stack" style={{ gap: 4 }}>
								{prompts.map((prompt) => (
									<div key={prompt.id} className="oa-inline" style={{ flexWrap: "nowrap" }}>
										<span className="oa-grow" style={prompt.active ? undefined : { color: "var(--muted)" }}>
											{prompt.text}
										</span>
										{prompt.active ? null : <Badge>Paused</Badge>}
										<Button variant="ghost" size="sm" onClick={() => onToggle(prompt.id, !prompt.active)}>
											{prompt.active ? "Pause" : "Resume"}
										</Button>
										<Button variant="ghost" size="sm" onClick={() => onRemove(prompt.id)} aria-label={`Remove: ${prompt.text}`}>
											Remove
										</Button>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				) : null}
</>
				}
			/>
	);
}
