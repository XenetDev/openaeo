import { type Fetched, parsePage } from "@openaeo/engine";

export function createSiteDescriber(get: (url: string) => Promise<Fetched>) {
	return async (domain: string): Promise<string | null> => {
		const page = await get(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`);
		if (page.status < 200 || page.status > 299 || !/html/i.test(page.contentType)) return null;
		const model = parsePage(page.url, page.text);
		const lines = [model.title, model.description, model.h1 ?? "", ...model.headings.slice(0, 8).map((h) => h.text)]
			.map((line) => line.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		return [...new Set(lines)].join("\n") || null;
	};
}
