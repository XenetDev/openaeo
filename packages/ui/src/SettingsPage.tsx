"use client";
import { useState } from "react";
import { lines } from "./format";
import type { EngineInfo, EntityView, ProjectView } from "./types";

export type SettingsPageProps = {
	engines: EngineInfo[];
	settings: Record<string, string>;
	project: ProjectView;
	onSave: (settings: Record<string, string>) => void;
	onSaveProject: (project: EntityView) => void;
	onDeleteProject: () => void;
	saved?: boolean;
};

export function SettingsPage({ engines, settings, project, onSave, onSaveProject, onDeleteProject, saved }: SettingsPageProps) {
	const [name, setName] = useState(project.name);
	const [aliases, setAliases] = useState(project.aliases.join(", "));
	const [domains, setDomains] = useState(project.domains.join(", "));
	const [key, setKey] = useState(settings["openai.apiKey"] ?? "");
	const [model, setModel] = useState(settings["openai.model"] ?? "");
	const [schedule, setSchedule] = useState(settings.schedule ?? "off");
	return (
		<div className="oa-page">
			<header className="oa-head">
				<div>
					<p className="oa-eyebrow">Settings</p>
					<h1 className="oa-title">Engines and brand details</h1>
				</div>
				{saved ? (
					<span className="oa-progress" role="status">
						Saved
					</span>
				) : null}
			</header>

			<section className="oa-section">
				<h2 className="oa-h2">AI engines</h2>
				<p className="oa-muted">OpenAEO uses the AI tools already signed in on this computer. Nothing is sent anywhere else.</p>
				<ul className="oa-list">
					{engines.map((engine) => (
						<li key={engine.id} className="oa-list-item">
							<span className="oa-list-text">
								<strong>{engine.label}</strong>
								{engine.reason ? <span className="oa-muted"> {engine.reason}</span> : null}
							</span>
							<span className="oa-tag" data-state={engine.available ? (engine.enabled ? "ready" : "off") : "missing"}>
								{engine.available ? (engine.enabled ? "Ready" : "Turned off") : "Unavailable"}
							</span>
							{engine.available ? (
								<button type="button" className="oa-link" onClick={() => onSave({ [`engine.${engine.id}.enabled`]: engine.enabled ? "false" : "true" })}>
									{engine.enabled ? "Turn off" : "Turn on"}
								</button>
							) : null}
						</li>
					))}
				</ul>
			</section>

			<form
				className="oa-form"
				onSubmit={(e) => {
					e.preventDefault();
					onSave({ "openai.apiKey": key, "openai.model": model, schedule });
				}}
			>
				<h2 className="oa-h2">Optional: OpenAI API</h2>
				<p className="oa-muted">Add a key to also ask OpenAI's API directly. The key is stored only on this computer.</p>
				<label className="oa-label" htmlFor="oa-key">
					API key
				</label>
				<input id="oa-key" className="oa-input" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
				<label className="oa-label" htmlFor="oa-model">
					Model name
				</label>
				<input id="oa-model" className="oa-input" value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" spellCheck={false} />
				<h2 className="oa-h2">Automatic runs</h2>
				<label className="oa-label" htmlFor="oa-schedule">
					Run while OpenAEO is open
				</label>
				<select id="oa-schedule" className="oa-select" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
					<option value="off">Only when I press Run now</option>
					<option value="daily">Once a day</option>
					<option value="weekly">Once a week</option>
				</select>
				<div className="oa-actions">
					<button type="submit" className="oa-button">
						Save settings
					</button>
				</div>
			</form>

			<form
				className="oa-form"
				onSubmit={(e) => {
					e.preventDefault();
					onSaveProject({ name, aliases: lines(aliases), domains: lines(domains) });
				}}
			>
				<h2 className="oa-h2">Brand</h2>
				<label className="oa-label" htmlFor="oa-name">
					Brand name
				</label>
				<input id="oa-name" className="oa-input" value={name} onChange={(e) => setName(e.target.value)} required />
				<label className="oa-label" htmlFor="oa-aliases">
					Other names it goes by, separated by commas
				</label>
				<input id="oa-aliases" className="oa-input" value={aliases} onChange={(e) => setAliases(e.target.value)} />
				<label className="oa-label" htmlFor="oa-domains">
					Websites, separated by commas
				</label>
				<input id="oa-domains" className="oa-input" value={domains} onChange={(e) => setDomains(e.target.value)} />
				<div className="oa-actions">
					<button type="submit" className="oa-button">
						Save brand
					</button>
					<button
						type="button"
						className="oa-link oa-danger"
						onClick={() => {
							if (window.confirm(`Delete ${project.name} and all of its runs? This cannot be undone.`)) onDeleteProject();
						}}
					>
						Delete this brand
					</button>
				</div>
			</form>
		</div>
	);
}
