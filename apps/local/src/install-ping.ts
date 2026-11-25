import type { SqliteStore } from "./store/store";

export const PING_URL = "";

const DAY = 24 * 60 * 60 * 1000;
const OFF = new Set(["off", "0", "false", "no"]);
const NOTICE =
	"OpenAEO counts installs: once a day it sends a random id, its version and your operating system. Nothing about your brands, questions or answers. Turn it off with OPENAEO_TELEMETRY=off.";

type Env = Record<string, string | undefined>;

export function pingAllowed(env: Env): boolean {
	if (OFF.has((env.OPENAEO_TELEMETRY ?? "").trim().toLowerCase())) return false;
	const doNotTrack = (env.DO_NOT_TRACK ?? "").trim().toLowerCase();
	return doNotTrack === "" || doNotTrack === "0" || doNotTrack === "false";
}

async function post(url: string, body: unknown): Promise<void> {
	await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(3000),
	});
}

export function createInstallPing(deps: {
	store: Pick<SqliteStore, "settings">;
	version: string;
	os: string;
	arch: string;
	env: Env;
	note: (line: string) => void;
	url?: string;
	now?: () => number;
	send?: (url: string, body: unknown) => Promise<void>;
}) {
	const { settings } = deps.store;
	const url = deps.url ?? PING_URL;
	const now = deps.now ?? Date.now;
	const send = deps.send ?? post;

	return async function ping(): Promise<void> {
		if (!url || !pingAllowed(deps.env)) return;
		const last = Number(settings.get("install.pinged") ?? 0);
		if (now() - last < DAY) return;

		let id = settings.get("install.id");
		if (!id) {
			id = crypto.randomUUID();
			settings.set("install.id", id);
			deps.note(NOTICE);
		}
		try {
			await send(url, { id, version: deps.version, os: deps.os, arch: deps.arch });
			settings.set("install.pinged", String(now()));
		} catch {}
	};
}
