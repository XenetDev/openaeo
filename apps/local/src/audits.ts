import { type AuditResult, type Fetched, type Finding, runAudit, sameSite, toDomain } from "@openaeo/engine";
import { type Log, logError } from "./log";
import type { Store, StoredAudit } from "./store/store";

export type AuditErrorCode = "already_running" | "no_url" | "bad_url" | "not_found";

export class AuditError extends Error {
	readonly code: AuditErrorCode;

	constructor(code: AuditErrorCode, message: string) {
		super(message);
		this.name = "AuditError";
		this.code = code;
	}
}

export function toOrigin(input: string): string | null {
	const value = input.trim();
	if (!value) return null;
	try {
		const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		if (!url.hostname.includes(".") && !url.hostname.includes(":") && url.hostname !== "localhost") return null;
		return url.origin;
	} catch {
		return null;
	}
}

export function createAuditService(deps: {
	store: Store;
	get: (url: string) => Promise<Fetched>;
	maxPages?: number;
	log?: Log;
}) {
	const { store } = deps;
	const log = deps.log ?? logError;
	const active = new Map<string, { controller: AbortController; done: Promise<StoredAudit> }>();

	async function execute(created: StoredAudit, controller: AbortController): Promise<StoredAudit> {
		let finished: StoredAudit | null = null;
		try {
			const result = await runAudit({
				url: created.origin,
				get: deps.get,
				maxPages: deps.maxPages,
				signal: controller.signal,
			});
			finished = store.audits.finish(
				created.id,
				controller.signal.aborted ? "interrupted" : "done",
				controller.signal.aborted ? null : result,
			);
		} catch (error) {
			if (!controller.signal.aborted) log(`audit ${created.id}`, error);
			try {
				finished = store.audits.finish(created.id, "interrupted", null);
			} catch (finishError) {
				if (!controller.signal.aborted) log(`finishing audit ${created.id}`, finishError);
			}
		}
		active.delete(created.id);
		return finished ?? { ...created, status: "interrupted", finishedAt: Date.now() };
	}

	return {
		start(projectId: string, url?: string): StoredAudit {
			const project = store.projects.get(projectId);
			if (!project) throw new AuditError("not_found", "That project does not exist.");
			const target = url?.trim() || project.domains[0];
			if (!target) throw new AuditError("no_url", "Add your website in Settings, or give an address to audit.");
			const origin = toOrigin(target);
			if (!origin) throw new AuditError("bad_url", `"${target.slice(0, 100)}" is not a web address OpenAEO can audit.`);
			if (store.audits.active(projectId))
				throw new AuditError("already_running", "An audit is already in progress for this project.");
			const host = toDomain(origin) ?? "";
			const sites = project.domains.map((d) => toDomain(toOrigin(d) ?? "")).filter((d): d is string => Boolean(d));
			const own = sites.length === 0 || sites.some((site) => sameSite(host, site) || sameSite(site, host));
			const created = store.audits.create(projectId, origin, own);
			const controller = new AbortController();
			active.set(created.id, { controller, done: execute(created, controller) });
			return created;
		},
		cancel(auditId: string): void {
			active.get(auditId)?.controller.abort();
		},
		cancelAll(): void {
			for (const entry of active.values()) entry.controller.abort();
		},
		async wait(auditId: string): Promise<StoredAudit> {
			const entry = active.get(auditId);
			if (entry) return entry.done;
			const stored = store.audits.get(auditId);
			if (!stored) throw new AuditError("not_found", "That audit does not exist.");
			return stored;
		},
	};
}

export type AuditService = ReturnType<typeof createAuditService>;

export function resultOf(audit: StoredAudit, findings: Finding[]): AuditResult {
	return {
		origin: audit.origin,
		startedAt: audit.startedAt,
		pages: audit.pages,
		findings,
		score: audit.score ?? 0,
		skipped: [],
	};
}
