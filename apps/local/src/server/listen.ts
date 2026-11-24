type Handler = (request: Request) => Response | Promise<Response>;

const inUse = (error: unknown) =>
	error instanceof Error && /EADDRINUSE|in use/i.test(`${error.message} ${"code" in error ? String(error.code) : ""}`);

export function listen(options: { first: number; attempts: number; handlerFor: (port: number) => Handler }) {
	for (let port = options.first; port < options.first + options.attempts; port += 1) {
		try {
			return Bun.serve({ hostname: "127.0.0.1", port, fetch: options.handlerFor(port), idleTimeout: 255 });
		} catch (error) {
			if (!inUse(error)) throw error;
		}
	}
	return null;
}
