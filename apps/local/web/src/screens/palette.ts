export const OWN = "var(--oa-own)";

export const OTHERS = [
	"var(--oa-series-1)",
	"var(--oa-series-2)",
	"var(--oa-series-3)",
	"var(--oa-series-4)",
	"var(--oa-series-5)",
	"var(--oa-series-6)",
];

export const METRICS = [OWN, ...OTHERS];

function slot(name: string): number {
	let hash = 0;
	for (const char of name.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return hash % OTHERS.length;
}

export function barColors(rows: { name: string; own?: boolean }[]): string[] {
	const taken = new Set<number>();
	const colors = new Map<string, string>();
	for (const name of rows
		.filter((row) => !row.own)
		.map((row) => row.name)
		.sort()) {
		if (colors.has(name)) continue;
		let index = slot(name);
		for (let tries = 0; taken.has(index) && tries < OTHERS.length; tries++) index = (index + 1) % OTHERS.length;
		taken.add(index);
		colors.set(name, OTHERS[index] as string);
	}
	return rows.map((row) => (row.own ? OWN : (colors.get(row.name) as string)));
}
