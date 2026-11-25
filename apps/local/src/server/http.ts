import type { z } from "zod";
import type { Store } from "../store/types";

export class HttpError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export const json = <T>(body: T, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", "cache-control": "no-store" },
	});

export const notFound = (what: string) => new HttpError(404, `${what} was not found.`);

export async function read<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw new HttpError(400, "The request body is not valid JSON.");
	}
	const parsed = schema.safeParse(body);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const field = issue?.path.join(".");
		throw new HttpError(400, field ? `${field}: ${issue?.message}` : (issue?.message ?? "The request is not valid."));
	}
	return parsed.data;
}

export async function requireProject(store: Store, id: string) {
	const found = await store.projects.get(id);
	if (!found) throw notFound("That project");
	return found;
}
