import type { EngineView } from "@api";
import { ArrowRight02Icon, Plug01Icon } from "@hugeicons/core-free-icons";
import { type ReactNode, useState } from "react";
import { Icon } from "@/components/app-shell";
import { ChipField, OnboardingFrame, Steps } from "@/components/onboarding-website";
import { Badge } from "@/components/ui/badge-clean";
import { Button } from "@/components/ui/button-clean";
import { Spinner } from "@/components/ui/spinner-clean";
import { TextField } from "@/components/ui/text-field-clean";
import { words } from "../wording";
import { EngineLogo } from "./shared";

type Frame = { product: string; email: string; steps: number; logo: ReactNode };

const isSubscription = (id: string) => id.endsWith("-cli");
const HOW: Record<string, string> = {
	"claude-cli": "Uses your Claude subscription through Claude Code",
	"codex-cli": "Uses your ChatGPT subscription through Codex",
	"gemini-cli": "Uses your Google account through the Gemini CLI",
};

export function EnginesStep({
	frame,
	step,
	engines,
	preview,
	onBack,
	onContinue,
	onSaveKey,
}: {
	frame: Frame;
	step: number;
	engines: EngineView[];
	preview: ReactNode;
	onBack: () => void;
	onContinue: () => void;
	onSaveKey: (id: string, key: string) => Promise<void>;
}) {
	const [keys, setKeys] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState<string | null>(null);
	const subscriptions = engines.filter((e) => isSubscription(e.id));
	const apis = engines.filter((e) => !isSubscription(e.id));
	const ready = engines.filter((e) => e.available && e.enabled).length;

	return (
		<OnboardingFrame {...frame} onBack={onBack} preview={preview}>
			<Steps step={step} steps={frame.steps} />
			<h1 className="ui-obw-title">Which AI engines should we ask?</h1>
			<p className="ui-obw-sub">{words.enginesIntro}</p>

			<div className="oa-ob-list">
				{subscriptions.map((e) => (
					<div key={e.id} className="oa-ob-row">
						<EngineLogo engine={e.id} label={e.label} size={18} />
						<span className="oa-grow">
							<b>{e.label}</b>
							<small>{e.available ? (HOW[e.id] ?? "Uses your subscription") : (e.reason ?? "Not installed")}</small>
						</span>
						<Badge tone={e.available ? "success" : "neutral"}>{e.available ? "Ready" : "Not found"}</Badge>
					</div>
				))}
				{apis.map((e) => (
					<div key={e.id} className="oa-ob-row" data-key={!e.available || undefined}>
						<EngineLogo engine={e.id} label={e.label} size={18} />
						<span className="oa-grow">
							<b>{e.label}</b>
							{e.available ? (
								<small>{words.engineReady}</small>
							) : (
								<form
									className="oa-ob-key"
									onSubmit={(event) => {
										event.preventDefault();
										const key = (keys[e.id] ?? "").trim();
										if (!key || saving) return;
										setSaving(e.id);
										void onSaveKey(e.id, key).finally(() => {
											setSaving(null);
											setKeys((all) => ({ ...all, [e.id]: "" }));
										});
									}}
								>
									<TextField
										type="password"
										aria-label={`${e.label} API key`}
										placeholder="Paste an API key"
										value={keys[e.id] ?? ""}
										onChange={(event) => setKeys((all) => ({ ...all, [e.id]: event.target.value }))}
										autoComplete="off"
									/>
									<Button
										type="submit"
										variant="secondary"
										loading={saving === e.id}
										disabled={!(keys[e.id] ?? "").trim()}
										icon={<Icon icon={Plug01Icon} size={14} />}
									>
										Connect
									</Button>
								</form>
							)}
						</span>
						{e.available ? <Badge tone="success">Ready</Badge> : null}
					</div>
				))}
			</div>

			<div className="oa-ob-foot">
				<Button
					data-autofocus
					disabled={ready === 0}
					iconRight={ready === 0 ? undefined : <Icon icon={ArrowRight02Icon} size={14} />}
					onClick={onContinue}
				>
					{ready === 0
						? "Connect an engine to continue"
						: `Continue with ${ready} ${ready === 1 ? "engine" : "engines"}`}
				</Button>
			</div>
		</OnboardingFrame>
	);
}

export function LocationStep({
	frame,
	step,
	defaultValue,
	preview,
	onBack,
	onContinue,
}: {
	frame: Frame;
	step: number;
	defaultValue: string;
	preview: ReactNode;
	onBack: () => void;
	onContinue: (location: string) => void;
}) {
	const [value, setValue] = useState(defaultValue);
	const location = value.trim();

	return (
		<OnboardingFrame {...frame} autoFocus onBack={onBack} preview={preview}>
			<Steps step={step} steps={frame.steps} />
			<h1 className="ui-obw-title">Where are your buyers?</h1>
			<p className="ui-obw-sub">
				AI answers change with location. OpenAEO asks every question as someone there would. You can change this later
				in Settings.
			</p>
			<form
				className="ui-obw-form"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					onContinue(location);
				}}
			>
				<ChipField
					chips={[]}
					onRemove={() => {}}
					brand=""
					mark={false}
					label="Location"
					hint={<p className="ui-obw-hint">{location ? " " : "Leave it empty if you sell everywhere"}</p>}
				>
					<input
						className="ui-obw-input"
						value={value}
						maxLength={80}
						onChange={(event) => setValue(event.target.value)}
						placeholder="London, United Kingdom"
						aria-label="Location"
						autoComplete="off"
						spellCheck={false}
					/>
					<button type="submit" className="ui-obw-btn ui-obw-btn--go" aria-label="Continue" title="Continue">
						<Icon icon={ArrowRight02Icon} size={14} />
					</button>
				</ChipField>
			</form>
		</OnboardingFrame>
	);
}

export type SetupTask = {
	id: string;
	label: string;
	detail?: string;
	state: "waiting" | "working" | "done" | "skipped";
};

export function FirstRunStep({
	frame,
	step,
	brand,
	tasks,
	finished,
	preview,
	onOpen,
}: {
	frame: Frame;
	step: number;
	brand: string;
	tasks: SetupTask[];
	finished: boolean;
	preview: ReactNode;
	onOpen: () => void;
}) {
	return (
		<OnboardingFrame {...frame} preview={preview}>
			<Steps step={step} steps={frame.steps} />
			<h1 className="ui-obw-title">{finished ? `${brand} is ready` : `Setting up ${brand}`}</h1>
			<p className="ui-obw-sub">
				{finished
					? "Your dashboard is filled in with the first answers."
					: "This runs on your own engines and takes a few minutes. You can open the dashboard at any time; it keeps going."}
			</p>

			<div className="oa-ob-list" aria-live="polite">
				{tasks.map((task) => (
					<div key={task.id} className="oa-ob-row" data-state={task.state}>
						<span className="oa-ob-mark">
							{task.state === "working" ? (
								<Spinner />
							) : task.state === "done" ? (
								"✓"
							) : task.state === "skipped" ? (
								"–"
							) : (
								""
							)}
						</span>
						<span className="oa-grow">
							<b>{task.label}</b>
							{task.detail ? <small>{task.detail}</small> : null}
						</span>
					</div>
				))}
			</div>

			<div className="oa-ob-foot">
				<Button
					data-autofocus
					variant={finished ? "primary" : "secondary"}
					iconRight={<Icon icon={ArrowRight02Icon} size={14} />}
					onClick={onOpen}
				>
					{finished ? "Open my dashboard" : "Open the dashboard now"}
				</Button>
			</div>
		</OnboardingFrame>
	);
}
