import {
	type Answer,
	type EngineId,
	type Provider,
	ProviderError,
	type ProviderErrorCode,
	type Source,
} from "@openaeo/engine";
import type { Log } from "../src/log";
import { openDb } from "../src/store/db";
import { createStore } from "../src/store/store";

export const freshStore = () => createStore(openDb(":memory:"));

export const src = (url: string): Source => ({ url, domain: new URL(url).hostname.replace(/^www\./, "") });

export function fakeProvider(
	id: EngineId,
	reply: (prompt: string) => string | { text: string; citations?: Source[]; sources?: Source[] } | ProviderErrorCode,
	delayMs = 0,
) {
	const calls: string[] = [];
	const provider: Provider = {
		id,
		async ask(prompt, opts) {
			calls.push(prompt);
			if (delayMs) {
				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(resolve, delayMs);
					opts?.signal?.addEventListener("abort", () => {
						clearTimeout(timer);
						reject(new ProviderError(id, "timeout", "cancelled"));
					});
				});
			}
			const value = reply(prompt);
			if (typeof value === "string" && /^[a-z_]+$/.test(value) && value.includes("_")) {
				throw new ProviderError(id, value as ProviderErrorCode, `${id} ${value}`);
			}
			const body = typeof value === "string" ? { text: value } : value;
			const answer: Answer = {
				engine: id,
				model: null,
				text: body.text,
				citations: body.citations ?? [],
				sources: body.sources ?? body.citations ?? [],
				searched: (body.sources ?? body.citations ?? []).length > 0,
				usage: null,
				durationMs: 1,
			};
			return answer;
		},
	};
	return { provider, calls };
}

export function seed(store: ReturnType<typeof freshStore>, prompts = ["best crm?", "cheapest crm?"]) {
	const project = store.projects.create({ name: "Pipedrive", aliases: [], domains: ["pipedrive.com"] });
	store.competitors.replace(project.id, [
		{ name: "HubSpot", aliases: [], domains: ["hubspot.com"] },
		{ name: "Attio", aliases: [], domains: [] },
	]);
	store.prompts.add(project.id, prompts);
	return project;
}

export function recordLog() {
	const entries: { context: string; error: unknown }[] = [];
	const log: Log = (context, error) => {
		entries.push({ context, error });
	};
	return { log, entries };
}
