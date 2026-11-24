import {
	Add01Icon,
	BubbleChatIcon,
	Delete02Icon,
	MoreHorizontalIcon,
	PauseIcon,
	PlayIcon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useRef } from "react";
import { EmptyState, Icon } from "@/components/app-shell";
import { type PexKeyword, type PexResult, PromptExplorerScreen } from "@/components/prompt-explorer";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { DropdownMenu } from "@/components/ui/dropdown-menu-clean";
import { IconButton } from "@/components/ui/icon-button-clean";
import { Spinner } from "@/components/ui/spinner-clean";
import type { PromptView, Suggestions } from "@/types";
import { SuggestMark } from "./command-icons";
import { Page } from "./shared";

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
	paused: !s.active,
	change: s.latest !== null && s.previous !== null ? (s.latest - s.previous) * 100 : 0,
	trend: s.history.map((h) => h.rate * 100),
});

export function PromptsScreen({
	brand,
	prompts,
	stats,
	suggestions,
	suggesting,
	onAdd,
	onToggle,
	onRemove,
	onSuggest,
	onDismissSuggestions,
	onOpen,
}: Props) {
	const keywords = stats.filter((s) => s.active).map(toKeyword);
	const ranked = [...stats.map(toKeyword)].sort((a, b) => Number(a.paused) - Number(b.paused) || b.volume - a.volume);
	const tracked = new Set(prompts.map((p) => p.text.toLowerCase()));
	const fresh = suggestions?.prompts.filter((p) => !tracked.has(p.toLowerCase())) ?? [];
	const spot = useRef<HTMLDivElement>(null);
	const arrived = suggestions !== null;
	useEffect(() => {
		if (suggesting || arrived) spot.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [suggesting, arrived]);

	return (
		<Page brand={brand} title="Prompts">
			<PromptExplorerScreen
				workspace={brand}
				prompts={keywords}
				popular={ranked}
				rising={keywords.filter((k) => k.change > 0).sort((a, b) => b.change - a.change)}
				falling={keywords.filter((k) => k.change < 0).sort((a, b) => a.change - b.change)}
				empty={stats.length === 0}
				rowMenu={(k) => (
					<DropdownMenu
						align="end"
						trigger={({ triggerProps }) => (
							<IconButton {...triggerProps} icon={MoreHorizontalIcon} label={`Actions for: ${k.text}`} size="sm" />
						)}
						items={[
							{ label: "Read the answers", icon: BubbleChatIcon, disabled: k.pending, onSelect: () => onOpen(k.text) },
							{
								label: k.paused ? "Resume" : "Pause",
								description: k.paused ? "Ask it again in runs" : "Keep it, but skip it in runs",
								icon: k.paused ? PlayIcon : PauseIcon,
								onSelect: () => onToggle(k.id, Boolean(k.paused)),
							},
							{ label: "Remove", icon: Delete02Icon, danger: true, divider: true, onSelect: () => onRemove(k.id) },
						]}
					/>
				)}
				onOpen={onOpen}
				onAnalyse={async (texts): Promise<PexResult[]> => {
					await onAdd(texts);
					return texts.map((text) => {
						const known = keywords.find((k) => k.text.toLowerCase() === text.toLowerCase());
						return {
							text,
							volume: known?.volume ?? 0,
							change: known?.change ?? 0,
							pending: known?.pending ?? true,
							trend: known?.trend ?? [],
							share: (known?.volume ?? 0) / 100,
						};
					});
				}}
				actions={
					<Button
						variant="ghost"
						size="sm"
						loading={suggesting}
						onClick={onSuggest}
						icon={<Icon icon={SparklesIcon} size={14} />}
					>
						Suggest questions
					</Button>
				}
				after={
					<>
						<div ref={spot} />
						{suggesting ? (
							<Card>
								<CardHeader
									icon={<Spinner />}
									title={`Writing questions for ${brand}`}
									description="Your AI engine reads your website and the questions you already track. This takes about half a minute."
								/>
							</Card>
						) : suggestions ? (
							<Card>
								<CardHeader
									icon={
										<span className="oa-cta-mark">
											<SuggestMark />
										</span>
									}
									title={fresh.length ? `${fresh.length} questions your buyers might ask` : "Suggested questions"}
									description={
										suggestions.fallback
											? "Generic starting points, because no AI engine could suggest better ones."
											: "Written by your AI engine from your website and the questions you already track. Click the ones a real buyer would ask."
									}
									action={
										<span className="oa-inline">
											{fresh.length > 1 ? (
												<Button size="sm" onClick={() => void onAdd(fresh)} icon={<Icon icon={Add01Icon} size={14} />}>
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
										<EmptyState
											bare
											icon={BubbleChatIcon}
											title="You already track all of these"
											text="Press Suggest questions again for a fresh set."
										/>
									) : (
										<div className="oa-suggest">
											{fresh.map((text) => (
												<button
													key={text}
													type="button"
													onClick={() => void onAdd([text])}
													aria-label={`Track: ${text}`}
												>
													<span className="oa-suggest-text">{text}</span>
													{text.toLowerCase().includes(brand.toLowerCase()) ? (
														<Badge tone="info">Names you</Badge>
													) : null}
													<i aria-hidden="true">
														<Icon icon={Add01Icon} size={14} />
													</i>
												</button>
											))}
										</div>
									)}
								</CardContent>
							</Card>
						) : null}
					</>
				}
			/>
		</Page>
	);
}
