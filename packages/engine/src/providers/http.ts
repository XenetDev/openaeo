import {
	type Answer,
	type AskOptions,
	type EngineId,
	ProviderError,
	type ProviderErrorCode,
	type Source,
} from "../types";
import { extractUrls } from "../url";
import { collectSources } from "./jsonl";

const DEFAULT_TIMEOUT_MS = 180_000;

export type ApiOptions = { apiKey: string; model?: string; fetch?: typeof fetch; baseUrl?: string };
export type Found = { url: string; title?: string };

export function failWith(engine: EngineId, code: ProviderErrorCode, message: string): never {
	throw new ProviderError(engine, code, message);
}

export async function postJson(o: {
	engine: EngineId;
	label: string;
	fetcher: typeof fetch;
	url: string;
	headers: Record<string, string>;
	body: unknown;
	apiKey: string;
	opts: AskOptions;
}): Promise<{ status: number; ok: boolean; json: unknown; redact: (text: string) => string }> {
	const redact = (text: string) => (o.apiKey ? text.split(o.apiKey).join("[key]") : text);
	const timeout = AbortSignal.timeout(o.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	const signal = o.opts.signal ? AbortSignal.any([o.opts.signal, timeout]) : timeout;
	let response: Response;
	let raw: string;
	try {
		response = await o.fetcher(o.url, {
			method: "POST",
			headers: { "content-type": "application/json", ...o.headers },
			body: JSON.stringify(o.body),
			signal,
		});
		raw = await response.text();
	} catch (error) {
		if (o.opts.signal?.aborted) failWith(o.engine, "timeout", `The ${o.label} request was cancelled.`);
		if (signal.aborted) failWith(o.engine, "timeout", `${o.label} did not answer in time.`);
		failWith(
			o.engine,
			"failed",
			`Could not reach ${o.label}: ${redact(error instanceof Error ? error.message : String(error))}`,
		);
	}
	let json: unknown = null;
	try {
		json = JSON.parse(raw);
	} catch {}
	return { status: response.status, ok: response.ok, json, redact };
}

export function finish(o: {
	engine: EngineId;
	label: string;
	model: string;
	text: string;
	cited: Found[];
	consulted: Found[];
	searched: boolean;
	usage: { inputTokens: number; outputTokens: number; searches: number } | null;
	started: number;
}): Answer {
	if (!o.text.trim()) failWith(o.engine, "failed", `${o.label} returned an empty answer.`);
	const citations: Source[] = collectSources([...o.cited, ...extractUrls(o.text).map((url) => ({ url }))]);
	const sources = o.searched ? collectSources([...o.consulted, ...citations]) : [];
	return {
		engine: o.engine,
		model: o.model,
		text: o.text,
		citations,
		sources,
		searched: o.searched,
		usage: o.usage,
		durationMs: Date.now() - o.started,
	};
}

export const rec = (value: unknown): Record<string, unknown> =>
	typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
export const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
export const str = (value: unknown): string => (typeof value === "string" ? value : "");
export const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
