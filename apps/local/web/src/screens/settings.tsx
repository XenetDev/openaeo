import type { EngineInfo, EntityView, ProjectView } from "@/types";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Icon } from "@/components/app-shell";
import { css as settingsCss } from "@/components/settings-general";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { CodeBlock } from "@/components/ui/code-block-clean";
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


const API_ENGINES = [
	{ id: "openai", name: "OpenAI", model: "gpt-6.1-terra" },
	{ id: "anthropic", name: "Anthropic", model: "claude-sonnet-5-5" },
	{ id: "xai", name: "xAI (Grok)", model: "grok-4.7" },
	{ id: "gemini", name: "Google Gemini", model: "gemini-3.8-flash" },
	{ id: "perplexity", name: "Perplexity", model: "perplexity/sonar" },
];

function ApiRow({ api, savedKey, savedModel, onSave }: { api: (typeof API_ENGINES)[number]; savedKey: string; savedModel: string; onSave: (next: Record<string, string>, message: string) => void }) {
	const [key, setKey] = useState(savedKey);
	const [model, setModel] = useState(savedModel);
	return (
		<div className="ui-sg-row">
			<span className="ui-sg-label">
				<b>{api.name}</b>
				<small>{savedKey ? "Key saved" : "No key"} · model {savedModel || api.model}</small>
			</span>
			<span className="oa-key-fields">
				<TextField
					aria-label={`${api.name} API key`}
					type="password"
					value={key}
					placeholder="API key"
					autoComplete="off"
					spellCheck={false}
					onChange={(e) => setKey(e.target.value)}
					onBlur={() => key !== savedKey && onSave({ [`${api.id}.apiKey`]: key }, key ? `${api.name} key saved` : `${api.name} key removed`)}
				/>
				<TextField
					aria-label={`${api.name} model`}
					value={model}
					placeholder={api.model}
					autoComplete="off"
					spellCheck={false}
					onChange={(e) => setModel(e.target.value)}
					onBlur={() => model !== savedModel && onSave({ [`${api.id}.model`]: model }, model ? `${api.name} model saved` : `${api.name} model reset`)}
				/>
			</span>
		</div>
	);
}

export function SettingsScreen({ engines, settings, project, onSave, onSaveProject, onDeleteProject }: Props) {
	const [name, setName] = useState(project.name);
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
				<p>OpenAEO asks the AI tools signed in on this computer, and any provider you add a key for below.</p>
			</header>
			<section className="ui-sg-card" aria-label="AI engines">
				{engines
					.filter((engine) => engine.id.endsWith("-cli") || engine.available)
					.map((engine) => (
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
			</section>

			<header className="ui-sg-head">
				<h2>API keys</h2>
				<p>Optional. Each key adds that provider as an engine. Keys are stored only on this computer and are never shown again in full.</p>
			</header>
			<section className="ui-sg-card" aria-label="API keys">
				{API_ENGINES.map((api) => (
					<ApiRow key={api.id} api={api} savedKey={settings[`${api.id}.apiKey`] ?? ""} savedModel={settings[`${api.id}.model`] ?? ""} onSave={onSave} />
				))}
			</section>

			<header className="ui-sg-head">
				<h2>Connect your AI agent</h2>
				<p>Let Claude Code or Codex read your reports and audit findings and fix problems in your site's code. Run one of these once in a terminal, then ask your agent to “get the OpenAEO fix brief and fix the findings”.</p>
			</header>
			<div className="oa-stack oa-after-head">
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
