import { type Answer, type EngineId, type Provider, ProviderError, type ProviderErrorCode } from "./types";

export type RunItem = { prompt: string; engine: EngineId } & (
	| { ok: true; answer: Answer }
	| { ok: false; error: ProviderError }
);

export type RunOptions = {
	prompts: string[];
	providers: Provider[];
	concurrency?: number;
	retries?: number;
	signal?: AbortSignal;
	timeoutMs?: number;
};

const RETRYABLE = new Set<ProviderErrorCode>(["rate_limited", "timeout", "failed"]);

function toProviderError(engine: EngineId, error: unknown): ProviderError {
	if (error instanceof ProviderError) return error;
	return new ProviderError(engine, "failed", error instanceof Error ? error.message : String(error));
}

export async function* run(o: RunOptions): AsyncGenerator<RunItem> {
	const jobs = o.prompts.flatMap((prompt) => o.providers.map((provider) => ({ prompt, provider })));
	if (jobs.length === 0) return;

	const controller = new AbortController();
	const stop = () => controller.abort();
	if (o.signal?.aborted) return;
	o.signal?.addEventListener("abort", stop, { once: true });

	const retries = Math.max(0, o.retries ?? 1);
	const ready: { item: RunItem; taken: () => void }[] = [];
	let wake: (() => void) | null = null;
	let next = 0;
	let running = 0;

	const notify = () => {
		wake?.();
		wake = null;
	};

	async function attempt(prompt: string, provider: Provider): Promise<RunItem> {
		for (let tries = 0; ; tries += 1) {
			try {
				const answer = await provider.ask(prompt, { signal: controller.signal, timeoutMs: o.timeoutMs });
				return { prompt, engine: provider.id, ok: true, answer };
			} catch (thrown) {
				const error = toProviderError(provider.id, thrown);
				if (tries >= retries || !RETRYABLE.has(error.code) || controller.signal.aborted) {
					return { prompt, engine: provider.id, ok: false, error };
				}
			}
		}
	}

	async function worker() {
		running += 1;
		while (!controller.signal.aborted) {
			const job = jobs[next];
			if (!job) break;
			next += 1;
			const item = await attempt(job.prompt, job.provider);
			if (controller.signal.aborted) break;
			await new Promise<void>((taken) => {
				ready.push({ item, taken });
				notify();
			});
		}
		running -= 1;
		notify();
	}

	const workers = Math.min(Math.max(1, Math.floor(o.concurrency ?? 2)), jobs.length);
	for (let i = 0; i < workers; i += 1) void worker();

	try {
		for (;;) {
			const entry = ready.shift();
			if (entry) {
				yield entry.item;
				entry.taken();
				continue;
			}
			if (running === 0 || controller.signal.aborted) return;
			await new Promise<void>((resolve) => {
				wake = resolve;
				controller.signal.addEventListener("abort", () => resolve(), { once: true });
			});
		}
	} finally {
		stop();
		for (const entry of ready) entry.taken();
		o.signal?.removeEventListener("abort", stop);
	}
}
