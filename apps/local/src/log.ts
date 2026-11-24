export type Log = (context: string, error: unknown) => void;

export const logError: Log = (context, error) => {
	const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
	process.stderr.write(`[openaeo] ${new Date().toISOString()} ${context}: ${detail}\n`);
};
