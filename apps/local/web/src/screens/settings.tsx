import type { EngineInfo, EntityView, ProjectView } from "@openaeo/ui";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Icon } from "@/components/app-shell";
import { css as settingsCss } from "@/components/settings-general";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { CodeBlock } from "@/components/ui/code-block-clean";
import { Select } from "@/components/ui/select-clean";
import { Switch } from "@/components/ui/switch-clean";
import { TagInput } from "@/components/ui/tag-input-clean";
import { TextField } from "@/components/ui/text-field-clean";

type Props = {
	engines: EngineInfo[];
	settings: Record<string, string>;
	project: ProjectView;
	onSave: (settings: Record<string, string>, message: string) => void;
	onSaveProject: (project: EntityView, message: string) => void;
	onDeleteProject: () => void;
};

const SCHEDULES = [
	{ value: "off", label: "Only when I press Run now", description: "Nothing runs on its own" },
	{ value: "daily", label: "Once a day", description: "While OpenAEO is open" },
	{ value: "weekly", label: "Once a week", description: "While OpenAEO is open" },
];

export function SettingsScreen({ engines, settings, project, onSave, onSaveProject, onDeleteProject }: Props) {
	const [name, setName] = useState(project.name);
	const [key, setKey] = useState(settings["openai.apiKey"] ?? "");
	const [model, setModel] = useState(settings["openai.model"] ?? "");
	const [deleting, setDeleting] = useState(false);
	const [confirm, setConfirm] = useState("");
	const canDelete = confirm.trim() === project.name.trim();
	const entity = (patch: Partial<EntityView>): EntityView => ({ name: project.name, aliases: project.aliases, domains: project.domains, ...patch });

	return (
		<div className="ui-as-page ui-sg">
			<style href="ui-settings-general" precedence="default">
				{settingsCss}
			</style>
			<h1 className="ui-as-page-title">Settings</h1>
			<p className="ui-as-page-sub">Engines, your agent connection and the brand you track.</p>

			<header className="ui-sg-head">
				<h2>AI engines</h2>
				<p>OpenAEO asks the AI tools already signed in on this computer. Nothing is sent anywhere else.</p>
			</header>
			<section className="ui-sg-card" aria-label="AI engines">
				{engines.map((engine) => (
					<div key={engine.id} className="ui-sg-row">
						<span className="ui-sg-label">
							<b>{engine.label}</b>
							<small>{engine.reason ?? (engine.enabled ? "Asked in every run" : "Skipped in runs")}</small>
						</span>
						<span className="ui-sg-control">
							{engine.available ? null : <Badge tone="warning">Unavailable</Badge>}
							<Switch
								aria-label={`Use ${engine.label}`}
								checked={engine.available && engine.enabled}
								disabled={!engine.available}
								onChange={(e) => onSave({ [`engine.${engine.id}.enabled`]: e.target.checked ? "true" : "false" }, `${engine.label} turned ${e.target.checked ? "on" : "off"}`)}
							/>
						</span>
					</div>
				))}
				<label className="ui-sg-row">
					<span className="ui-sg-label">
						<b>OpenAI API key</b>
						<small>Optional. Also asks OpenAI's API directly. Stored only on this computer.</small>
					</span>
					<TextField
						className="ui-sg-field"
						aria-label="OpenAI API key"
						value={key}
						placeholder="sk-…"
						autoComplete="off"
						spellCheck={false}
						onChange={(e) => setKey(e.target.value)}
						onBlur={() => key !== (settings["openai.apiKey"] ?? "") && onSave({ "openai.apiKey": key }, key ? "API key saved" : "API key removed")}
					/>
				</label>
				<label className="ui-sg-row">
					<span className="ui-sg-label">
						<b>OpenAI model</b>
						<small>The model name to ask, as OpenAI lists it</small>
					</span>
					<TextField
						className="ui-sg-field"
						aria-label="OpenAI model"
						value={model}
						autoComplete="off"
						spellCheck={false}
						onChange={(e) => setModel(e.target.value)}
						onBlur={() => model !== (settings["openai.model"] ?? "") && onSave({ "openai.model": model }, "Model saved")}
					/>
				</label>
			</section>

			<header className="ui-sg-head">
				<h2>Automatic runs</h2>
			</header>
			<section className="ui-sg-card" aria-label="Automatic runs">
				<div className="ui-sg-row">
					<span className="ui-sg-label">
						<b>Run schedule</b>
						<small>A brand you have never run is not started automatically</small>
					</span>
					<Select
						className="ui-sg-field"
						aria-label="Run schedule"
						options={SCHEDULES}
						value={settings.schedule ?? "off"}
						onChange={(value, option) => onSave({ schedule: value }, `Schedule: ${String(option.label).toLowerCase()}`)}
					/>
				</div>
			</section>

			<header className="ui-sg-head">
				<h2>Connect your AI agent</h2>
				<p>Let Claude Code or Codex read your reports and audit findings and fix problems in your site's code. Run one of these once in a terminal, then ask your agent to “get the OpenAEO fix brief and fix the findings”.</p>
			</header>
			<div className="oa-stack">
				<CodeBlock language="sh" filename="Claude Code" code="claude mcp add openaeo --scope user -- openaeo mcp" />
				<CodeBlock language="sh" filename="Codex" code="codex mcp add openaeo -- openaeo mcp" />
			</div>

			<header className="ui-sg-head">
				<h2>Brand</h2>
			</header>
			<section className="ui-sg-card" aria-label="Brand">
				<label className="ui-sg-row">
					<span className="ui-sg-label">
						<b>Brand name</b>
						<small>The name OpenAEO looks for in answers</small>
					</span>
					<TextField
						className="ui-sg-field"
						aria-label="Brand name"
						value={name}
						maxLength={200}
						onChange={(e) => setName(e.target.value)}
						onBlur={() => (name.trim() && name.trim() !== project.name ? onSaveProject(entity({ name: name.trim() }), "Brand name saved") : setName(project.name))}
					/>
				</label>
				<div className="ui-sg-row">
					<span className="ui-sg-label">
						<b>Other names</b>
						<small>Short forms and product names that also count as a mention</small>
					</span>
					<TagInput className="ui-sg-field" aria-label="Other names" value={project.aliases} onChange={(aliases) => onSaveProject(entity({ aliases }), "Names saved")} placeholder="Add a name" max={20} />
				</div>
				<div className="ui-sg-row">
					<span className="ui-sg-label">
						<b>Websites</b>
						<small>Your own sites. A link to one counts as being cited</small>
					</span>
					<TagInput
						className="ui-sg-field"
						aria-label="Websites"
						value={project.domains}
						onChange={(domains) => onSaveProject(entity({ domains }), "Websites saved")}
						placeholder="yourcompany.com"
						max={20}
						normalize={(t) => t.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")}
					/>
				</div>
			</section>

			<header className="ui-sg-head">
				<h2>Danger zone</h2>
			</header>
			<section className="ui-sg-card ui-sg-card--danger" aria-label="Danger zone">
				<div className="ui-sg-row">
					<span className="ui-sg-label">
						<b>Delete this brand</b>
						<small>All questions, runs, answers and audits of {project.name} go for good.</small>
					</span>
					{!deleting && (
						<button type="button" className="ui-sg-danger" onClick={() => setDeleting(true)}>
							<Icon icon={Delete02Icon} size={15} />
							Delete brand
						</button>
					)}
				</div>
				{deleting && (
					<form
						className="ui-sg-confirm"
						onKeyDown={(e) => e.key === "Escape" && setDeleting(false)}
						onSubmit={(e) => {
							e.preventDefault();
							if (canDelete) onDeleteProject();
						}}
					>
						<label>
							<span>
								Type <b>{project.name}</b> to confirm
							</span>
							<TextField className="ui-sg-field" value={confirm} autoFocus autoComplete="off" spellCheck={false} onChange={(e) => setConfirm(e.target.value)} />
						</label>
						<span className="ui-sg-control">
							<Button size="sm" variant="secondary" type="button" onClick={() => setDeleting(false)}>
								Cancel
							</Button>
							<button type="submit" className="ui-sg-danger ui-sg-danger--solid" disabled={!canDelete}>
								Delete for good
							</button>
						</span>
					</form>
				)}
			</section>
		</div>
	);
}
