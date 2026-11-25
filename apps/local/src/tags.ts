const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 40;

export function cleanTags(tags: string[]): string[] {
	const seen = new Map<string, string>();
	for (const raw of tags) {
		const tag = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH);
		if (tag && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
	}
	return [...seen.values()].slice(0, MAX_TAGS);
}
