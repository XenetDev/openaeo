import { writeSync } from "node:fs";

export function writeLine(line: string) {
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
