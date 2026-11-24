import type { PageId } from "@api";
import {
	AiChat02Icon,
	BubbleChatIcon,
	CheckListIcon,
	Clock01Icon,
	DashboardSquare01Icon,
	News01Icon,
	Search01Icon,
	Settings01Icon,
	Target02Icon,
	UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import type { ShellNavItem } from "@/components/app-shell";

export const PAGES: { id: PageId; label: string; icon: ShellNavItem["icon"] }[] = [
	{ id: "overview", label: "Overview", icon: DashboardSquare01Icon },
	{ id: "prompts", label: "Prompts", icon: Search01Icon },
	{ id: "answers", label: "Answers", icon: BubbleChatIcon },
	{ id: "sources", label: "Sources", icon: News01Icon },
	{ id: "competitors", label: "Competitors", icon: UserMultipleIcon },
	{ id: "opportunities", label: "Opportunities", icon: Target02Icon },
	{ id: "audit", label: "Audit", icon: CheckListIcon },
	{ id: "runs", label: "Runs", icon: Clock01Icon },
	{ id: "ask", label: "Ask Aeo", icon: AiChat02Icon },
	{ id: "settings", label: "Settings", icon: Settings01Icon },
];

export const NEW_BRAND = "Track another brand";
export const NEW_BRAND_KEY = "brand:new";
export const pageKey = (id: PageId) => `page:${id}`;
export const brandKey = (id: string) => `brand:${id}`;

export const NAV: ShellNavItem[] = PAGES.filter((page) => page.id !== "settings").map((page) => ({
	id: pageKey(page.id),
	label: page.label,
	icon: page.icon,
}));

export const isPage = (value: string): value is PageId => PAGES.some((page) => page.id === value);
export const pageFromHash = (): PageId => {
	const hash = window.location.hash.slice(1);
	return isPage(hash) ? hash : "overview";
};
