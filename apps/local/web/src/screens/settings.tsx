import type { EngineInfo, EntityView, NewProject, ProjectView } from "@openaeo/ui";
import { useState } from "react";
import { Button } from "@/components/ui/button-clean";
import { TextField } from "@/components/ui/text-field-clean";
import { Head } from "./shared";

const split = (value: string) =>
	value
		.split(/[\n,]/)
		.map((v) => v.trim())
		.filter(Boolean);
const byLine = (value: string) =>
	value
		.split("\n")
		.map((v) => v.trim())
		.filter(Boolean);

type SettingsProps = {
	engines: EngineInfo[];
	settings: Record<string, string>;
	project: ProjectView;
	saved: boolean;
	onSave: (settings: Record<string, string>) => void;
	onSaveProject: (project: EntityView) => void;
	onDeleteProject: () => void;
};

export function SettingsScreen({ engines, settings, project, saved, onSave, onSaveProject, onDeleteProject }: SettingsProps) {
	const [name, setName] = useState(project.name);
	const [aliases, setAliases] = useState(project.aliases.join(", "));
	const [domains, setDomains] = useState(project.domains.join(", "));
	const [key, setKey] = useState(settings["openai.apiKey"] ?? "");
	const [model, setModel] = useState(settings["openai.model"] ?? "");
	const [schedule, setSchedule] = useState(settings.schedule ?? "off");
	return (
		<div className="oa-view">
			<Head section="Settings" title="Engines and brand details" actions={saved ? <span className="oa-tag" data-tone="good">Saved</span> : undefined} />

			<section className="oa-card">
				<h2 className="oa-cap">
					AI engines <span>the tools already signed in on this computer</span>
				</h2>
				<ul className="oa-rows">
					{engines.map((engine) => (
						<li key={engine.id} className="oa-list-item">
							<span>
								{engine.label}
								{engine.reason ? <span className="oa-dim"> · {engine.reason}</span> : null}
							</span>
							<span className="oa-tag" data-tone={engine.available ? (engine.enabled ? "good" : undefined) : "bad"}>
								{engine.available ? (engine.enabled ? "Ready" : "Turned off") : "Unavailable"}
							</span>
							{engine.available ? (
								<button type="button" className="oa-plain" onClick={() => onSave({ [`engine.${engine.id}.enabled`]: engine.enabled ? "false" : "true" })}>
									{engine.enabled ? "Turn off" : "Turn on"}
								</button>
							) : null}
						</li>
					))}
				</ul>
			</section>

			<section className="oa-card">
				<h2 className="oa-cap">Connect your AI agent</h2>
				<p className="oa-note">
					Let Claude Code or Codex read your reports and audit findings, and fix problems in your site's code. Run one of these once in a terminal, then ask your agent to “get the
					OpenAEO fix brief and fix the findings”.
				</p>
				<pre className="oa-code">claude mcp add openaeo --scope user -- openaeo mcp</pre>
				<pre className="oa-code">codex mcp add openaeo -- openaeo mcp</pre>
			</section>

			<section className="oa-card">
				<h2 className="oa-cap">Automatic runs and the optional OpenAI API</h2>
				<form
					className="oa-form"
					onSubmit={(e) => {
						e.preventDefault();
						onSave({ "openai.apiKey": key, "openai.model": model, schedule });
					}}
				>
					<div>
						<label className="oa-label" htmlFor="oa-schedule">
							Run while OpenAEO is open
						</label>
						<select id="oa-schedule" className="oa-select" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
							<option value="off">Only when I press Run now</option>
							<option value="daily">Once a day</option>
							<option value="weekly">Once a week</option>
						</select>
					</div>
					<TextField label="OpenAI API key" optional hint="Stored only on this computer." value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
					<TextField label="OpenAI model name" optional value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" spellCheck={false} />
					<div className="oa-actions">
						<Button type="submit" size="sm">
							Save settings
						</Button>
					</div>
				</form>
			</section>

			<section className="oa-card">
				<h2 className="oa-cap">Brand</h2>
				<form
					className="oa-form"
					onSubmit={(e) => {
						e.preventDefault();
						onSaveProject({ name, aliases: split(aliases), domains: split(domains) });
					}}
				>
					<TextField label="Brand name" value={name} onChange={(e) => setName(e.target.value)} required />
					<TextField label="Other names it goes by" hint="Separate with commas." value={aliases} onChange={(e) => setAliases(e.target.value)} />
					<TextField label="Websites" hint="Separate with commas." value={domains} onChange={(e) => setDomains(e.target.value)} />
					<div className="oa-actions">
						<Button type="submit" size="sm">
							Save brand
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onClick={() => {
								if (window.confirm(`Delete ${project.name} and all of its runs? This cannot be undone.`)) onDeleteProject();
							}}
						>
							Delete this brand
						</Button>
					</div>
				</form>
			</section>
		</div>
	);
}

type OnboardingProps = { engines: EngineInfo[]; busy: boolean; error: string | null; onCreate: (project: NewProject) => void; onCancel?: () => void };

export function OnboardingScreen({ engines, busy, error, onCreate, onCancel }: OnboardingProps) {
	const [name, setName] = useState("");
	const [site, setSite] = useState("");
	const [competitors, setCompetitors] = useState("");
	const [prompts, setPrompts] = useState("");
	return (
		<div className="oa-view">
			<div className="oa-onboard">
				<h1 className="oa-title" style={{ fontSize: 28, lineHeight: "36px" }}>
					See how AI answers talk about your brand
				</h1>
				<p className="oa-sub" style={{ marginBottom: 20 }}>
					Tell OpenAEO what to track. It asks the AI tools already signed in on this computer and shows who gets recommended.
				</p>
				<section className="oa-card">
					<ul className="oa-rows">
						{engines
							.filter((e) => e.id !== "openai")
							.map((engine) => (
								<li key={engine.id} className="oa-list-item">
									<span>
										{engine.label}
										{engine.available ? null : <span className="oa-dim"> · {engine.reason}</span>}
									</span>
									<span className="oa-tag" data-tone={engine.available ? "good" : "bad"}>
										{engine.available ? "Ready" : "Unavailable"}
									</span>
								</li>
							))}
					</ul>
				</section>
				<form
					className="oa-form"
					style={{ maxWidth: "none", marginTop: 16 }}
					onSubmit={(e) => {
						e.preventDefault();
						onCreate({ name: name.trim(), aliases: [], domains: split(site), competitors: byLine(competitors).map((c) => ({ name: c, aliases: [], domains: [] })), prompts: byLine(prompts) });
					}}
				>
					<TextField label="Brand name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" required />
					<TextField label="Website" value={site} onChange={(e) => setSite(e.target.value)} placeholder="acme.com" />
					<div>
						<label className="oa-label" htmlFor="oa-o-comp">
							Competitors, one per line
						</label>
						<textarea id="oa-o-comp" className="oa-textarea" rows={3} value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder={"Competitor One\nCompetitor Two"} />
					</div>
					<div>
						<label className="oa-label" htmlFor="oa-o-prompts">
							Questions buyers ask, one per line
						</label>
						<textarea id="oa-o-prompts" className="oa-textarea" rows={3} value={prompts} onChange={(e) => setPrompts(e.target.value)} placeholder="What is the best tool for …?" />
						<p className="oa-note" style={{ marginTop: 6 }}>
							You can leave this empty and let OpenAEO suggest questions afterwards.
						</p>
					</div>
					{error ? (
						<p className="oa-alert" role="alert" style={{ marginBottom: 0 }}>
							{error}
						</p>
					) : null}
					<div className="oa-actions">
						<Button type="submit" loading={busy} disabled={name.trim() === ""}>
							Start tracking
						</Button>
						{onCancel ? (
							<Button type="button" variant="ghost" onClick={onCancel}>
								Cancel
							</Button>
						) : null}
					</div>
				</form>
			</div>
		</div>
	);
}
