#!/usr/bin/env bun
import { randomBytes } from "node:crypto";
import { createSafeFetch } from "@openaeo/engine";
import pkg from "../package.json" with { type: "json" };
import { diskAssets, embeddedAssets } from "./assets";
import { createAuditService } from "./audits";
import { auditOnce, HELP, parseArgs, runOnce } from "./cli";
import { suggestCompetitors } from "./competitor-ideas";
import { createSiteDescriber } from "./describe-site";
import { embedded } from "./embedded";
import { buildProviders, detectEngines } from "./engines";
import { dataDir, dbPath } from "./paths";
import { createRunService } from "./runs";
import { createScheduler } from "./scheduler";
import { createHandler } from "./server/handler";
import { listen } from "./server/listen";
import { writeLine as out } from "./stdout";
import { openDb } from "./store/db";
import { createStore } from "./store/store";
import { suggestPrompts } from "./suggest";

const exit = async (code: number): Promise<never> => process.exit(code);
const args = parseArgs(process.argv.slice(2));

if (args.command === "error") {
	process.stderr.write(`${args.message}\n`);
	process.exit(2);
}
if (args.command === "version") {
	out(pkg.version);
	await exit(0);
}
if (args.command === "help") {
	out(HELP);
	await exit(0);
}

const store = createStore(openDb(dbPath(dataDir())));
store.runs.interruptStale();
store.audits.interruptStale();
const get = createSafeFetch({
	allowLoopback: true,
	userAgent: `OpenAEO-Audit/${pkg.version} (+https://github.com/jdships/openaeo)`,
});
const audits = createAuditService({ store, get });
const engineDeps = { store, which: (bin: string) => Bun.which(bin) };
const runs = createRunService({
	store,
	providers: () => buildProviders(engineDeps),
	sentiment: true,
	brandCheck: true,
});

const release = () => {
	runs.cancelAll();
	audits.cancelAll();
	store.runs.interruptOwn();
	store.audits.interruptOwn();
};
const stop = () => {
	release();
	process.exit(130);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("SIGHUP", stop);

if (args.command === "status") {
	const projects = store.projects.list();
	out(
		projects.length
			? `Projects: ${projects.map((p) => p.name).join(", ")}`
			: "No project yet. Run `openaeo` to set one up.",
	);
	for (const engine of await detectEngines(engineDeps)) {
		out(
			`${engine.label.padEnd(18)}${engine.available ? (engine.enabled ? "ready" : "turned off") : `unavailable: ${engine.reason}`}`,
		);
	}
	await exit(0);
}

if (args.command === "mcp") {
	const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
	const { createMcpServer } = await import("./mcp");
	await createMcpServer({ store, runs, audits, version: pkg.version }).connect(new StdioServerTransport());
	await new Promise<void>((resolve) => process.stdin.on("close", resolve));
	release();
	process.exit(0);
}

if (args.command === "audit") {
	await exit(await auditOnce({ store, audits, get, out, json: args.json, url: args.url, project: args.project }));
}

if (args.command === "run") {
	await exit(await runOnce({ store, runs, out, json: args.json, project: args.project }));
}

const token = randomBytes(24).toString("hex");
const assets = Object.keys(embedded).length > 0 ? embeddedAssets(embedded) : diskAssets();
const firstProvider = async () => (await buildProviders(engineDeps))[0] ?? null;
const first = args.port ?? 4747;
const server = listen({
	first,
	attempts: args.port ? 1 : 20,
	handlerFor: (port) =>
		createHandler({
			store,
			runs,
			audits,
			engines: () => detectEngines(engineDeps),
			token,
			port,
			assets,
			suggest: async (context) => suggestPrompts(await firstProvider(), context),
			describeSite: createSiteDescriber(get),
			competitorIdeas: async (context) => suggestCompetitors(await firstProvider(), context),
			askProvider: async (engine) =>
				(await buildProviders(engineDeps)).find((p) => p.id === engine) ?? (await firstProvider()),
		}),
});
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
