import { tokenIn } from "./session";

export type AccountLink = {
	label: string;
	href: string;
	description?: string;
	checked?: boolean;
	divider?: boolean;
};

export const runtime = {
	cloud: false,
	url: (path: string): string => path,
	token: (): string => document.querySelector<HTMLMetaElement>('meta[name="openaeo-token"]')?.content ?? "",
	freshToken: async (): Promise<string | null> => tokenIn(await (await fetch("/", { cache: "no-store" })).text()),
	upgrade: null as (() => void) | null,
	schedules: ["off", "daily", "weekly"],
	account: {
		name: "This computer",
		plan: "Local",
		links: [] as AccountLink[],
	},
};
