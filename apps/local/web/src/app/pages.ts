import type { PageId } from "@api";
import {
	AiChat02Icon,
	BubbleChatIcon,
	CheckListIcon,
	Clock01Icon,
	DashboardSquare01Icon,
	Flag02Icon,
	Megaphone01Icon,
	News01Icon,
	Search01Icon,
	Settings01Icon,
	Target02Icon,
	UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import type { ShellGroup, ShellNavItem } from "@/components/app-shell";
import { HOST_POSTS } from "../host";

type Section = "main" | "results" | "tracking" | "hidden";

export const PAGES: { id: PageId; label: string; icon: ShellNavItem["icon"]; section: Section }[] = [
	{ id: "overview", label: "Overview", icon: DashboardSquare01Icon, section: "main" },
	{ id: "plan", label: "Plan", icon: Flag02Icon, section: "main" },
	{ id: "audit", label: "Audit", icon: CheckListIcon, section: "main" },
	{ id: "posts", label: "Posts", icon: Megaphone01Icon, section: HOST_POSTS ? "main" : "hidden" },
	{ id: "ask", label: "Ask Aeo", icon: AiChat02Icon, section: "main" },
	{ id: "answers", label: "Answers", icon: BubbleChatIcon, section: "results" },
	{ id: "opportunities", label: "Opportunities", icon: Target02Icon, section: "results" },
	{ id: "sources", label: "Sources", icon: News01Icon, section: "results" },
	{ id: "competitors", label: "Competitors", icon: UserMultipleIcon, section: "results" },
	{ id: "prompts", label: "Prompts", icon: Search01Icon, section: "tracking" },
	{ id: "runs", label: "Runs", icon: Clock01Icon, section: "tracking" },
	{ id: "settings", label: "Settings", icon: Settings01Icon, section: "hidden" },
];

export const pageLabel = (id: PageId): string => PAGES.find((page) => page.id === id)?.label ?? "";
export const NEW_BRAND = "Track another brand";
export const NEW_BRAND_KEY = "brand:new";
export const pageKey = (id: PageId) => `page:${id}`;
export const brandKey = (id: string) => `brand:${id}`;

const section = (name: Section): ShellNavItem[] =>
	PAGES.filter((page) => page.section === name).map((page) => ({
		id: pageKey(page.id),
		label: page.label,
		icon: page.icon,
	}));

export const NAV = section("main");
export const NAV_GROUPS: ShellGroup[] = [
	{ label: "Results", items: section("results") },
	{ label: "Tracking", items: section("tracking") },
];

export const isPage = (value: string): value is PageId => PAGES.some((page) => page.id === value);
export const pageFromHash = (): PageId => {
	const hash = window.location.hash.slice(1);
	return isPage(hash) && (hash !== "posts" || HOST_POSTS) ? hash : "overview";
};
