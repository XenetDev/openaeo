import { useRef, useState } from "react";
import { AppShell, type ShellNavItem } from "@/components/app-shell";
import { Mark } from "@/components/mark";
import { OnboardingBrandScreen } from "@/components/onboarding-brand";
import { brandFrom, OnboardingWebsiteScreen } from "@/components/onboarding-website";
import { Badge } from "@/components/ui/badge-clean";
import { Card, CardContent, CardHeader } from "@/components/ui/card-clean";
import { StatCard } from "@/components/ui/stat-card-clean";
import type { EngineInfo, NewProject } from "@/types";
import type { CompetitorIdea } from "../api";
import { EnginesStep } from "./onboarding-steps";
import { Page, ShareList } from "./shared";

type Props = {
	engines: EngineInfo[];
	nav: ShellNavItem[];
	busy: boolean;
	onCreate: (project: NewProject) => void;
	onCancel?: () => void;
	onFindCompetitors?: (name: string, domain?: string) => Promise<CompetitorIdea[]>;
	onSaveKey: (engineId: string, key: string) => Promise<void>;
};

export function SetupPreview({
	brand,
	domains,
	competitors,
	engines,
	nav,
}: {
	brand: string;
	domains: string[];
	competitors: string[];
	engines: EngineInfo[];
	nav: ShellNavItem[];
}) {
	const name = brand || "Your brand";
	return (
		<div inert aria-hidden="true" style={{ height: "100%" }}>
			<AppShell
				active="Overview"
				workspace={name}
				workspaceMeta="Local"
				user={{ name: "This computer" }}
				nav={nav}
				groups={[]}
				sideCards={false}
			>
				<Page brand={name} title="Overview">
					<div className="ui-as-rev__stats">
						{["Visibility score", "Mentioned in", "Your site cited in", "Average position"].map((label) => (
							<StatCard
								key={label}
								className="ui-as-rev__stat"
								layout="inline"
								label={label}
								value=""
								change={0}
								loading
								chart={<span />}
							/>
						))}
					</div>
					<div className="ui-as-rev__row ui-as-rev__row--3">
						<Card>
							<CardHeader title="Who gets mentioned" description="You and the competitors you track" />
							<CardContent>
								<ShareList
									items={[
										{ label: name, value: "–", share: 0, badge: <Badge>You</Badge> },
										...competitors.map((c) => ({ label: c, value: "–", share: 0 })),
									]}
								/>
							</CardContent>
						</Card>
						<Card>
							<CardHeader title="Your websites" description="A link to one counts as being cited" />
							<CardContent>
								<ShareList
									items={domains.map((d) => ({ label: d, value: "–", share: 0 }))}
									empty={<p className="oa-quiet">Add your website to see it here.</p>}
								/>
							</CardContent>
						</Card>
						<Card>
							<CardHeader title="AI engines" description="The tools signed in on this computer" />
							<CardContent>
								<div className="oa-stack" style={{ gap: 8 }}>
									{engines
										.filter((e) => e.id.endsWith("-cli") || e.available)
										.map((e) => (
											<span key={e.id} className="oa-inline">
												<span className="oa-grow">{e.label}</span>
												<Badge tone={e.available ? "success" : "warning"}>
													{e.available ? "Ready" : "Not installed"}
												</Badge>
											</span>
										))}
								</div>
							</CardContent>
						</Card>
					</div>
				</Page>
			</AppShell>
		</div>
	);
}

export function OnboardingFlow({ engines, nav, busy, onCreate, onCancel, onFindCompetitors, onSaveKey }: Props) {
	const [step, setStep] = useState(1);
	const [domains, setDomains] = useState<string[]>([]);
	const [names, setNames] = useState<string[]>([]);
	const [rivals, setRivals] = useState<string[]>([]);
	const frame = { product: "OpenAEO", email: "Runs on this computer", steps: 5, logo: <Mark size={20} /> };
	const brand = names[0] ?? brandFrom(domains[0]);
	const [found, setFound] = useState<CompetitorIdea[] | null>(null);
	const [looking, setLooking] = useState(false);
	const asked = useRef("");
	const touched = useRef(false);
	const look = (name: string, domain?: string) => {
		const key = `${name}|${domain ?? ""}`;
		if (!onFindCompetitors || !name || asked.current === key) return;
		asked.current = key;
		setFound(null);
		setLooking(true);
		const settle = (list: CompetitorIdea[]) => {
			if (asked.current !== key) return;
			setFound(list);
			setLooking(false);
		};
		onFindCompetitors(name, domain).then(settle, () => settle([]));
	};
	const prefill = found && found.length > 0 && !touched.current ? found.map((c) => c.name) : [];

	if (step === 1) {
		return (
			<OnboardingWebsiteScreen
				{...frame}
				step={1}
				autoFocus
				defaultDomains={domains}
				onBack={onCancel}
				title="What's your website?"
				sub="OpenAEO checks how AI answers talk about it. Add your docs or help centre too."
				preview={(s) => (
					<SetupPreview
						brand={s.brand}
						domains={s.pending ? [...s.domains, s.pending] : s.domains}
						competitors={[]}
						engines={engines}
						nav={nav}
					/>
				)}
				onContinue={(next) => {
					setDomains(next);
					setStep(2);
				}}
			/>
		);
	}
	if (step === 2) {
		return (
			<OnboardingBrandScreen
				{...frame}
				step={2}
				autoFocus
				domain={domains[0]}
				defaultNames={names.length ? names : undefined}
				onBack={() => setStep(1)}
				title="What's your brand called?"
				sub="OpenAEO looks for this name in AI answers. Add short forms and product names too."
				label="Brand names"
				hint={(all) => (all.length > 1 ? "The first name is your brand; the others also count as a mention" : " ")}
				preview={(s) => (
					<SetupPreview
						brand={s.names[0] ?? s.pending}
						domains={domains}
						competitors={[]}
						engines={engines}
						nav={nav}
					/>
				)}
				onContinue={(next) => {
					setNames(next);
					touched.current = false;
					look(next[0] ?? brandFrom(domains[0]), domains[0]);
					setStep(3);
				}}
			/>
		);
	}
	if (step === 4) {
		const sites = new Map((found ?? []).map((c) => [c.name.toLowerCase(), c.domain]));
		return (
			<EnginesStep
				frame={frame}
				step={4}
				engines={engines}
				onBack={() => setStep(3)}
				onSaveKey={onSaveKey}
				preview={<SetupPreview brand={brand} domains={domains} competitors={rivals} engines={engines} nav={nav} />}
				onContinue={() =>
					!busy &&
					onCreate({
						name: brand || "My brand",
						aliases: names.slice(1),
						domains,
						competitors: rivals.slice(0, 50).map((name) => ({
							name,
							aliases: [],
							domains: sites.get(name.toLowerCase()) ? [sites.get(name.toLowerCase()) as string] : [],
						})),
						prompts: [],
					})
				}
			/>
		);
	}
	return (
		<OnboardingBrandScreen
			{...frame}
			key={`competitors-${prefill.length}`}
			step={3}
			autoFocus
			defaultNames={rivals.length ? rivals : prefill}
			optional
			onBack={() => setStep(2)}
			title="Who do you compete with?"
			sub={
				prefill.length
					? "Your AI engine found these. Remove any that are not real competitors, and add ones it missed."
					: "OpenAEO tracks who gets recommended instead of you. You can add or change these later."
			}
			label="Competitors"
			placeholder="Add a competitor"
			hint={(all) =>
				busy
					? "Setting up…"
					: looking && !all.length
						? "Looking for your competitors… you can type or skip while it works"
						: all.length
							? "Press Enter on an empty field to continue"
							: "Leave it empty to skip"
			}
			preview={(s) => {
				if (s.pending || (looking && s.names.length > 0)) touched.current = true;
				return (
					<SetupPreview
						brand={brand}
						domains={domains}
						competitors={s.pending ? [...s.names, s.pending] : s.names}
						engines={engines}
						nav={nav}
					/>
				);
			}}
			onContinue={(competitors) => {
				setRivals(competitors);
				setStep(4);
			}}
		/>
	);
}
