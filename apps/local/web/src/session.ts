export type Session = {
	send: (request: (token: string) => Promise<Response>) => Promise<Response>;
};

export function tokenIn(html: string): string | null {
	return /<meta name="openaeo-token" content="([^"]*)">/.exec(html)?.[1] ?? null;
}

export function createSession(initial: string, load: () => Promise<string | null>): Session {
	let token = initial;
	return {
		async send(request) {
			const used = token;
			const response = await request(used);
			if (response.status !== 403) return response;
			if (token === used) {
				const fresh = await load().catch(() => null);
				if (fresh) token = fresh;
			}
			return token === used ? response : request(token);
		},
	};
}
