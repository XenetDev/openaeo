#!/usr/bin/env bun
import { randomBytes } from "node:crypto";
import { writeSync } from "node:fs";
import pkg from "../package.json" with { type: "json" };
import { diskAssets, embeddedAssets } from "./assets";
import { createSafeFetch, parsePage } from "@openaeo/engine";
import { createAuditService } from "./audits";
import { auditOnce, HELP, parseArgs, runOnce } from "./cli";
import { embedded } from "./embedded";
import { buildProviders, detectEngines } from "./engines";
import { dataDir, dbPath } from "./paths";
import { createRunService } from "./runs";
import { createScheduler } from "./scheduler";
import { createHandler } from "./server/handler";
import { openDb } from "./store/db";
import { createStore } from "./store/store";
import { suggestPrompts } from "./suggest";

function out(line: string) {
	const data = Buffer.from(`${line}\n`);
	let offset = 0;
	let stalls = 0;
	while (offset < data.length) {
		try {
			offset += writeSync(1, data, offset);
			stalls = 0;
		} catch (error) {
			if (!(error instanceof Error) || !("code" in error) || error.code !== "EAGAIN" || stalls > 2000) return;
			stalls += 1;
			Bun.sleepSync(2);
		}
	}
}
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
const get = createSafeFetch({ allowPrivate: true, userAgent: `OpenAEO-Audit/${pkg.version} (+https://github.com/jdships/openaeo)` });
const audits = createAuditService({ store, get });
const engineDeps = { store, which: (bin: string) => Bun.which(bin) };
const runs = createRunService({ store, providers: () => buildProviders(engineDeps), sentiment: true });

const stop = () => {
	runs.cancelAll();
	audits.cancelAll();
	store.runs.interruptOwn();
	store.audits.interruptOwn();
	process.exit(130);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("SIGHUP", stop);

if (args.command === "status") {
	const projects = store.projects.list();
	out(projects.length ? `Projects: ${projects.map((p) => p.name).join(", ")}` : "No project yet. Run `openaeo` to set one up.");
	for (const engine of detectEngines(engineDeps)) {
		out(`${engine.label.padEnd(18)}${engine.available ? (engine.enabled ? "ready" : "turned off") : `unavailable: ${engine.reason}`}`);
	}
	await exit(0);
}

if (args.command === "mcp") {
	const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
	const { createMcpServer } = await import("./mcp");
	await createMcpServer({ store, runs, audits, version: pkg.version }).connect(new StdioServerTransport());
	await new Promise<void>((resolve) => process.stdin.on("close", resolve));
	runs.cancelAll();
	audits.cancelAll();
	store.runs.interruptOwn();
	store.audits.interruptOwn();
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
const first = args.port ?? 4747;
let server: ReturnType<typeof Bun.serve> | null = null;
for (let port = first; port < first + (args.port ? 1 : 20) && !server; port += 1) {
	try {
		const handler = createHandler({ store, runs, audits, engines: () => detectEngines(engineDeps), token, port, assets, suggest: (context) => suggestPrompts(buildProviders(engineDeps)[0] ?? null, context),
			describeSite: async (domain) => {
				const page = await get(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`);
				if (page.status < 200 || page.status > 299 || !/html/i.test(page.contentType)) return null;
				const model = parsePage(page.url, page.text);
				const lines = [model.title, model.description, model.h1 ?? "", ...model.headings.slice(0, 8).map((h) => h.text)].map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
				return [...new Set(lines)].join("\n") || null;
			},
			askProvider: (engine) => {
				const ready = buildProviders(engineDeps);
				return ready.find((p) => p.id === engine) ?? ready[0] ?? null;
			},
		});
		server = Bun.serve({ hostname: "127.0.0.1", port, fetch: handler, idleTimeout: 255 });
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
