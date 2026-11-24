export type RouteContext = { request: Request; params: Record<string, string> };
export type Route = {
	method: string;
	segments: string[];
	handle: (context: RouteContext) => Response | Promise<Response>;
};

export function route(method: string, pattern: string, handle: Route["handle"]): Route {
	return { method, segments: pattern.split("/").filter(Boolean), handle };
}

function match(segments: string[], parts: string[]): Record<string, string> | null {
	if (segments.length !== parts.length) return null;
	const params: Record<string, string> = {};
	for (const [index, segment] of segments.entries()) {
		const part = parts[index] as string;
		if (segment.startsWith(":")) params[segment.slice(1)] = part;
		else if (segment !== part) return null;
	}
	return params;
}

export function createRouter(routes: Route[]) {
	return (request: Request, path: string): Response | Promise<Response> | null => {
		const parts = path.split("/").filter(Boolean);
		for (const candidate of routes) {
			if (candidate.method !== request.method) continue;
			const params = match(candidate.segments, parts);
			if (params) return candidate.handle({ request, params });
		}
		return null;
	};
}
