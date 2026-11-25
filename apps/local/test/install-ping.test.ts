import { expect, test } from "bun:test";
import { createInstallPing, pingAllowed } from "../src/install-ping";
import { freshStore } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

function setup(over: { env?: Record<string, string | undefined>; url?: string; fail?: boolean } = {}) {
	const store = freshStore();
	const sent: { url: string; body: unknown }[] = [];
	const notes: string[] = [];
	let now = 1_800_000_000_000;
	const ping = createInstallPing({
		store,
		url: over.url ?? "https://example.test/api/telemetry/install",
		version: "0.1.0",
		os: "darwin",
		arch: "arm64",
		env: over.env ?? {},
		now: () => now,
		note: (line) => notes.push(line),
		send: async (url, body) => {
			if (over.fail) throw new Error("offline");
			sent.push({ url, body });
		},
	});
	return { store, sent, notes, ping, advance: (ms: number) => (now += ms) };
}

test("the ping carries a random id, the version and the system, and nothing else", async () => {
	const { ping, sent, store } = setup();
	await ping();
	expect(sent.length).toBe(1);
	const body = sent[0]?.body as Record<string, string>;
	expect(Object.keys(body).sort()).toEqual(["arch", "id", "os", "version"]);
	expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	expect(body).toMatchObject({ version: "0.1.0", os: "darwin", arch: "arm64" });
	expect(store.settings.get("install.id")).toBe(body.id as string);
});

test("it is sent at most once a day and keeps the same id", async () => {
	const { ping, sent, advance } = setup();
	await ping();
	await ping();
	advance(DAY - 1);
	await ping();
	expect(sent.length).toBe(1);
	advance(2);
	await ping();
	expect(sent.length).toBe(2);
	const ids = sent.map((message) => (message.body as { id: string }).id);
	expect(ids[1]).toBe(ids[0] as string);
});

test("the first run says what is sent and how to turn it off, once", async () => {
	const { ping, notes, advance } = setup();
	await ping();
	advance(DAY + 1);
	await ping();
	expect(notes.length).toBe(1);
	expect(notes[0]).toContain("OPENAEO_TELEMETRY=off");
});

test("it stays silent when turned off, when asked not to track, or with nowhere to send", async () => {
	for (const env of [{ OPENAEO_TELEMETRY: "off" }, { OPENAEO_TELEMETRY: "0" }, { DO_NOT_TRACK: "1" }]) {
		const { ping, sent, notes, store } = setup({ env });
		await ping();
		expect(sent).toEqual([]);
		expect(notes).toEqual([]);
		expect(store.settings.get("install.id")).toBeNull();
	}
	const { ping, sent } = setup({ url: "" });
	await ping();
	expect(sent).toEqual([]);
	expect(pingAllowed({ DO_NOT_TRACK: "0" })).toBe(true);
});

test("a failed ping is ignored and tried again the next time", async () => {
	const failing = setup({ fail: true });
	await failing.ping();
	expect(failing.store.settings.get("install.pinged")).toBeNull();
});
