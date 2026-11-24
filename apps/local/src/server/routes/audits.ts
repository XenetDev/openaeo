import { artefacts, buildFixBrief } from "@openaeo/engine";
import type { AuditView, LatestAudit, Ok } from "../../api-types";
import { AuditError, resultOf } from "../../audits";
import type { HandlerDeps } from "../handler";
import { HttpError, json, notFound, read, requireProject } from "../http";
import { type Route, route } from "../router";
import { StartAuditSchema } from "../schemas";

const STATUS: Record<string, number> = { already_running: 409, no_url: 400, bad_url: 400, not_found: 404 };

export function auditRoutes({ store, audits }: HandlerDeps): Route[] {
	if (!audits) return [];
	const requireAudit = (id: string) => {
		const found = store.audits.get(id);
		if (!found) throw notFound("That audit");
		return found;
	};

	return [
		route("POST", "/api/projects/:id/audits", async ({ request, params }) => {
			const input = await read(request, StartAuditSchema);
			try {
				return json<{ audit: AuditView }>({ audit: audits.start(params.id as string, input.url) }, 202);
			} catch (error) {
				if (error instanceof AuditError) throw new HttpError(STATUS[error.code] ?? 400, error.message);
				throw error;
			}
		}),
		route("GET", "/api/projects/:id/audits/latest", ({ params }) => {
			const project = requireProject(store, params.id as string);
			const audit = store.audits.latest(project.id);
			if (!audit) return json<LatestAudit>({ audit: null, findings: [], artefacts: {} });
			const findings = store.audits.findings(audit.id);
			const own = audit.status === "done" && audit.own;
			return json<LatestAudit>({
				audit,
				findings,
				artefacts: own ? artefacts(resultOf(audit, findings), { name: project.name }) : {},
			});
		}),
		route("POST", "/api/audits/:id/cancel", ({ params }) => {
			audits.cancel(requireAudit(params.id as string).id);
			return json<Ok>({ ok: true });
		}),
		route("GET", "/api/audits/:id/brief", ({ params }) => {
			const audit = requireAudit(params.id as string);
			if (audit.status !== "done")
				throw new HttpError(409, "That audit did not finish, so there is no brief. Run the audit again.");
			return new Response(buildFixBrief(resultOf(audit, store.audits.findings(audit.id))), {
				headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
			});
		}),
	];
}
