"use client";
import { useState } from "react";
import { byLine, lines } from "./format";
import type { EngineInfo, NewProject } from "./types";

export type OnboardingProps = { engines: EngineInfo[]; onCreate: (project: NewProject) => void; busy: boolean; error: string | null; onCancel?: () => void };

export function Onboarding({ engines, onCreate, busy, error, onCancel }: OnboardingProps) {
	const [name, setName] = useState("");
	const [site, setSite] = useState("");
	const [competitors, setCompetitors] = useState("");
	const [prompts, setPrompts] = useState("");
	const subscription = engines.filter((e) => e.id !== "openai");
	return (
		<div className="oa-onboard">
			<div className="oa-brand">
				<span className="oa-brand-mark" aria-hidden="true" />
				OpenAEO
			</div>
			<h1 className="oa-display">See how AI answers talk about your brand.</h1>
			<p className="oa-lede">Tell OpenAEO what to track. It asks the AI tools already signed in on this computer and shows who gets recommended.</p>

			<ul className="oa-engines">
				{subscription.map((engine) => (
					<li key={engine.id} data-state={engine.available ? "ready" : "missing"}>
						<strong>{engine.label}</strong>
						<span>{engine.available ? "Ready" : engine.reason}</span>
					</li>
				))}
			</ul>

			<form
				className="oa-form"
				onSubmit={(e) => {
					e.preventDefault();
					onCreate({
						name: name.trim(),
						aliases: [],
						domains: lines(site),
						competitors: byLine(competitors).map((c) => ({ name: c, aliases: [], domains: [] })),
						prompts: byLine(prompts),
					});
				}}
			>
				<label className="oa-label" htmlFor="oa-o-name">
					Brand name
				</label>
				<input id="oa-o-name" className="oa-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" required />
				<label className="oa-label" htmlFor="oa-o-site">
					Website
				</label>
				<input id="oa-o-site" className="oa-input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="acme.com" />
				<label className="oa-label" htmlFor="oa-o-comp">
					Competitors, one per line
				</label>
				<textarea id="oa-o-comp" className="oa-input" rows={3} value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder={"Competitor One\nCompetitor Two"} />
				<label className="oa-label" htmlFor="oa-o-prompts">
					Questions buyers ask, one per line
				</label>
				<textarea
					id="oa-o-prompts"
					className="oa-input"
					rows={4}
					value={prompts}
					onChange={(e) => setPrompts(e.target.value)}
					placeholder={"What is the best tool for …?\nWhich … is best for a small team?"}
				/>
				<p className="oa-muted">You can leave the questions empty and add them afterwards.</p>
				{error ? (
					<p className="oa-alert" role="alert">
						{error}
					</p>
				) : null}
				<div className="oa-actions">
					<button type="submit" className="oa-button" disabled={busy || name.trim() === ""}>
						{busy ? "Setting up…" : "Start tracking"}
					</button>
					{onCancel ? (
						<button type="button" className="oa-link" onClick={onCancel}>
							Cancel
						</button>
					) : null}
				</div>
			</form>
		</div>
	);
}
