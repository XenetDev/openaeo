"use client";
import { useState } from "react";
import type { PromptView, Suggestions } from "./types";

export type PromptsPageProps = {
	prompts: PromptView[];
	onAdd: (texts: string[]) => void;
	onToggle: (id: string, active: boolean) => void;
	onRemove: (id: string) => void;
	onSuggest?: () => void;
	suggesting?: boolean;
	suggestions?: Suggestions | null;
};

export function PromptsPage({ prompts, onAdd, onToggle, onRemove, onSuggest, suggesting, suggestions }: PromptsPageProps) {
	const seed = suggestions?.prompts.join("\n") ?? "";
	const [draft, setDraft] = useState(seed);
	const [seeded, setSeeded] = useState(seed);
	if (seed !== seeded) {
		setSeeded(seed);
		setDraft(seed);
	}
	const texts = draft
		.split("\n")
		.map((t) => t.trim())
		.filter(Boolean);
	return (
		<div className="oa-page">
			<header className="oa-head">
				<div>
					<p className="oa-eyebrow">Prompts</p>
					<h1 className="oa-title">The questions your buyers ask AI</h1>
				</div>
			</header>
			<form
				className="oa-form"
				onSubmit={(e) => {
					e.preventDefault();
					if (texts.length === 0) return;
					onAdd(texts);
					setDraft("");
				}}
			>
				<label className="oa-label" htmlFor="oa-new-prompts">
					Add questions, one per line
				</label>
				<textarea
					id="oa-new-prompts"
					className="oa-input"
					rows={Math.min(12, Math.max(3, draft.split("\n").length + 1))}
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					placeholder="What is the best CRM for a small marketing agency?"
				/>
				{suggestions && draft === seed && seed ? (
					<p className="oa-muted">
						{suggestions.fallback
							? "These are generic starting points, because no AI engine could suggest better ones. Edit them to match how your buyers talk."
							: "Suggested by AI. Edit or delete any line, then add them."}
					</p>
				) : null}
				<div className="oa-actions">
					<button type="submit" className="oa-button" disabled={texts.length === 0}>
						Add {texts.length > 1 ? `${texts.length} questions` : "question"}
					</button>
					{onSuggest ? (
						<button type="button" className="oa-button oa-button-quiet" onClick={onSuggest} disabled={suggesting}>
							{suggesting ? "Thinking…" : "Suggest questions"}
						</button>
					) : null}
				</div>
			</form>
			{prompts.length === 0 ? (
				<section className="oa-empty">
					<h2>No questions yet</h2>
					<p>Add the questions a buyer would type into ChatGPT or Claude when looking for something like yours. Write them the way a person would ask, not as keywords.</p>
				</section>
			) : (
				<ul className="oa-list">
					{prompts.map((prompt, index) => (
						<li key={prompt.id} className="oa-list-item" data-paused={!prompt.active}>
							<span className="oa-nav-index">{String(index + 1).padStart(2, "0")}</span>
							<span className="oa-list-text">{prompt.text}</span>
							{prompt.active ? null : <span className="oa-tag">Paused</span>}
							<button type="button" className="oa-link" onClick={() => onToggle(prompt.id, !prompt.active)}>
								{prompt.active ? "Pause" : "Resume"}
							</button>
							<button type="button" className="oa-link oa-danger" onClick={() => onRemove(prompt.id)} aria-label={`Remove: ${prompt.text}`}>
								Remove
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

