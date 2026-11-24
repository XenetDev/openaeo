import type { PageId, ProjectView } from "@api";
import {
	ComputerIcon,
	Globe02Icon,
	Moon02Icon,
	PaintBoardIcon,
	Plug01Icon,
	PlusSignIcon,
	Settings01Icon,
	Sun03Icon,
} from "@hugeicons/core-free-icons";
import { type ReactNode, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AgentMark, AuditMark, BrandMark, BriefMark, RunMark, SuggestMark } from "../screens/command-icons";
import { saveTheme, storedTheme, type Theme } from "../theme";
import { brandKey, isPage, NAV, NAV_GROUPS, NEW_BRAND, NEW_BRAND_KEY, pageKey } from "./pages";

const THEMES = [
	["System", ComputerIcon],
	["Light", Sun03Icon],
	["Dark", Moon02Icon],
] as const;

const COMMANDS = [
	{
		id: "suggestions",
		label: "Suggestions",
		commands: [
			{
				id: "run",
				label: "Run now",
				hint: "Ask every engine your questions",
				logo: <RunMark />,
				keywords: "start ask engines",
			},
			{
				id: "audit",
				label: "Audit your website",
				hint: "Check what AI engines can read",
				logo: <AuditMark />,
				keywords: "check site crawl robots",
			},
			{
				id: "suggest",
				label: "Suggest questions",
				hint: "Ideas from your AI engine",
				logo: <SuggestMark />,
				keywords: "prompts ideas",
			},
			{
				id: "brief",
				label: "Copy fix brief",
				hint: "For Claude Code or Codex",
				logo: <BriefMark />,
				keywords: "agent fix findings",
			},
			{
				id: "agent",
				label: "Connect your AI agent",
				hint: "Claude Code or Codex",
				logo: <AgentMark />,
				keywords: "mcp connect",
			},
		],
	},
	{
		id: "brands",
		label: "Brands",
		commands: [
			{
				id: "new",
				label: NEW_BRAND,
				hint: "Start tracking a new name",
				logo: <BrandMark />,
				keywords: "add project",
			},
		],
	},
];

type Props = {
	projects: ProjectView[];
	project: ProjectView | null;
	page: PageId | null;
	children: ReactNode;
	onPage: (page: PageId) => void;
	onBrand: (id: string) => void;
	onNewBrand: () => void;
	onCommand: (id: string, text?: string) => void;
};

export function Shell({ projects, project, page, children, onPage, onBrand, onNewBrand, onCommand }: Props) {
	const [theme, setTheme] = useState<Theme>(storedTheme);

	const navigate = (key: string) => {
		const [kind, id = ""] = key.split(/:(.*)/s);
		if (key === NEW_BRAND_KEY) onNewBrand();
		else if (kind === "brand") onBrand(id);
		else if (kind === "page" && isPage(id)) onPage(id);
	};

	return (
		<AppShell
			active={page ? pageKey(page) : ""}
			workspace={project?.name ?? "OpenAEO"}
			workspaceMeta="Local"
			user={{ name: "This computer" }}
			nav={project ? NAV : []}
			groups={
				projects.length > 0
					? [
							...(project ? NAV_GROUPS : []),
							{
								label: "Brands",
								items: [
									...projects.map((p) => ({ id: brandKey(p.id), label: p.name, icon: Globe02Icon })),
									{ id: NEW_BRAND_KEY, label: NEW_BRAND, icon: PlusSignIcon },
								],
							},
						]
					: []
			}
			sideCards={false}
			workspaceItems={[
				...projects.map((p) => ({
					label: p.name,
					checked: p.id === project?.id,
					onSelect: () => onBrand(p.id),
				})),
				{ label: NEW_BRAND, icon: PlusSignIcon, divider: true, onSelect: onNewBrand },
				...(project ? [{ label: "Brand settings", icon: Settings01Icon, onSelect: () => onPage("settings") }] : []),
			]}
			accountItems={[
				{
					label: "Appearance",
					icon: PaintBoardIcon,
					submenu: THEMES.map(([mode, icon]) => ({
						label: mode,
						icon,
						checked: mode === theme,
						onSelect: () => {
							saveTheme(mode);
							setTheme(mode);
						},
					})),
				},
				...(project
					? [
							{ label: "Connect your AI agent", icon: Plug01Icon, onSelect: () => onPage("settings") },
							{ label: "Settings", icon: Settings01Icon, onSelect: () => onPage("settings") },
						]
					: []),
			]}
			commands={project ? COMMANDS : []}
			typedCommand={{
				group: "Questions",
				label: (text) => `Track “${text}” as a question`,
				done: (text) => `Tracking “${text}”`,
			}}
			onCommand={onCommand}
			onNavigate={navigate}
		>
			{children}
		</AppShell>
	);
}
