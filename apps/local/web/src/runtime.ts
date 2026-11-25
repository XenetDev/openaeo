import { tokenIn } from "./session";

export const runtime = {
	cloud: false,
	url: (path: string): string => path,
	token: (): string => document.querySelector<HTMLMetaElement>('meta[name="openaeo-token"]')?.content ?? "",
	freshToken: async (): Promise<string | null> => tokenIn(await (await fetch("/", { cache: "no-store" })).text()),
};
