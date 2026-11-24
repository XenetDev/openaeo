#!/usr/bin/env bun
import { randomBytes } from "node:crypto";
import pkg from "../package.json" with { type: "json" };
import { diskAssets, embeddedAssets } from "./assets";
import { HELP, parseArgs, runOnce } from "./cli";
import { embedded } from "./embedded";
import { buildProviders, detectEngines } from "./engines";
import { dataDir, dbPath } from "./paths";
import { createRunService } from "./runs";
import { createScheduler } from "./scheduler";
import { createHandler } from "./server/handler";
import { openDb } from "./store/db";
import { createStore } from "./store/store";
import { suggestPrompts } from "./suggest";

const out = (line: string) => process.stdout.write(`${line}\n`);
const args = parseArgs(process.argv.slice(2));

if (args.command === "error") {
	process.stderr.write(`${args.message}\n`);
	process.exit(2);
}
if (args.command === "version") {
	out(pkg.version);
	process.exit(0);
}
if (args.command === "help") {
	out(HELP);
	process.exit(0);
}

const store = createStore(openDb(dbPath(dataDir())));
store.runs.interruptStale();
const engineDeps = { store, which: (bin: string) => Bun.which(bin) };
const runs = createRunService({ store, providers: () => buildProviders(engineDeps), sentiment: true });

const stop = () => {
	runs.cancelAll();
	process.exit(130);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

if (args.command === "status") {
	const projects = store.projects.list();
	out(projects.length ? `Projects: ${projects.map((p) => p.name).join(", ")}` : "No project yet. Run `openaeo` to set one up.");
	for (const engine of detectEngines(engineDeps)) {
		out(`${engine.label.padEnd(18)}${engine.available ? (engine.enabled ? "ready" : "turned off") : `unavailable: ${engine.reason}`}`);
	}
	process.exit(0);
}

if (args.command === "run") {
	process.exit(await runOnce({ store, runs, out, json: args.json, project: args.project }));
}

const token = randomBytes(24).toString("hex");
const assets = Object.keys(embedded).length > 0 ? embeddedAssets(embedded) : diskAssets();
const first = args.port ?? 4747;
let server: ReturnType<typeof Bun.serve> | null = null;
for (let port = first; port < first + (args.port ? 1 : 20) && !server; port += 1) {
	try {
		const handler = createHandler({ store, runs, engines: () => detectEngines(engineDeps), token, port, assets, suggest: (context) => suggestPrompts(buildProviders(engineDeps)[0] ?? null, context) });
		server = Bun.serve({ hostname: "127.0.0.1", port, fetch: handler, idleTimeout: 60 });
	} catch (error) {
		if (!(error instanceof Error) || !/EADDRINUSE|in use/i.test(`${error.message} ${"code" in error ? String(error.code) : ""}`)) throw error;
	}
}
if (!server) {
	process.stderr.write(`Could not find a free port starting at ${first}. Try \`openaeo --port <number>\`.\n`);
	process.exit(1);
}

createScheduler({ store, runs }).start();
const url = `http://127.0.0.1:${server.port}`;
out(`OpenAEO is running at ${url}`);
out("Press Ctrl+C to stop.");
if (args.open) {
	const opener = process.platform === "darwin" ? "open" : "xdg-open";
	if (Bun.which(opener)) Bun.spawn([opener, url], { stdout: "ignore", stderr: "ignore" });
}
