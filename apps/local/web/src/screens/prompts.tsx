import type { PromptView, Suggestions } from "@openaeo/ui";
import { PromptExplorerScreen, type PexKeyword, type PexResult } from "@/components/prompt-explorer";
import { Button } from "@/components/ui/button-clean";

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
	change: s.latest !== null && s.previous !== null ? (s.latest - s.previous) * 100 : 0,
	trend: s.history.map((h) => h.rate * 100),
});

export function PromptsScreen({ brand, prompts, stats, suggestions, suggesting, onAdd, onToggle, onRemove, onSuggest, onDismissSuggestions, onOpen }: Props) {
	const keywords = stats.filter((s) => s.active).map(toKeyword);
	const ranked = [...keywords].sort((a, b) => b.volume - a.volume);
	const tracked = new Set(prompts.map((p) => p.text.toLowerCase()));
	const fresh = suggestions?.prompts.filter((p) => !tracked.has(p.toLowerCase())) ?? [];

	return (
		<div style={{ height: "100%", overflowY: "auto" }}>
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
						return { text, volume: known?.volume ?? 0, change: known?.change ?? 0, trend: known?.trend ?? [], share: (known?.volume ?? 0) / 100 };
					});
				}}
				actions={
					<Button variant="ghost" size="sm" loading={suggesting} onClick={onSuggest}>
						Suggest questions
					</Button>
				}
			/>
			<div className="oa-view" style={{ height: "auto", overflow: "visible", paddingTop: 0 }}>
				{suggestions ? (
					<section className="oa-card">
						<h2 className="oa-cap">
							Suggested questions
							<button type="button" className="oa-plain" onClick={onDismissSuggestions}>
								Dismiss
							</button>
						</h2>
						<p className="oa-note" style={{ marginBottom: 8 }}>
							{suggestions.fallback
								? "Generic starting points, because no AI engine could suggest better ones."
								: "Suggested by your AI engine from your brand and competitors. Track the ones a real buyer would ask."}
						</p>
						{fresh.length === 0 ? (
							<p className="oa-note">You already track all of these.</p>
						) : (
							<>
								<ul className="oa-rows">
									{fresh.map((text) => (
										<li key={text} className="oa-list-item">
											<span>{text}</span>
											<button type="button" className="oa-plain" onClick={() => void onAdd([text])}>
												Track
											</button>
										</li>
									))}
								</ul>
								<div className="oa-actions" style={{ marginTop: 12 }}>
									<Button size="sm" onClick={() => void onAdd(fresh)}>
										Track all {fresh.length}
									</Button>
								</div>
							</>
						)}
					</section>
				) : null}

				{prompts.length > 0 ? (
					<section className="oa-card">
						<h2 className="oa-cap">
							Manage questions <span>{prompts.filter((p) => p.active).length} active</span>
						</h2>
						<ul className="oa-rows">
							{prompts.map((prompt) => (
								<li key={prompt.id} className="oa-list-item">
									<span style={prompt.active ? undefined : { color: "var(--muted)" }}>
										{prompt.text}
										{prompt.active ? null : <span className="oa-tag">Paused</span>}
									</span>
									<button type="button" className="oa-plain" onClick={() => onToggle(prompt.id, !prompt.active)}>
										{prompt.active ? "Pause" : "Resume"}
									</button>
									<button type="button" className="oa-plain" data-danger="true" onClick={() => onRemove(prompt.id)} aria-label={`Remove: ${prompt.text}`}>
										Remove
									</button>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</div>
		</div>
	);
}
