type Rule = { allow: boolean; pattern: string; matcher: RegExp };
type Group = { agents: string[]; rules: Rule[] };
export type Robots = { groups: Group[] };

function toMatcher(pattern: string): RegExp {
	const anchored = pattern.endsWith("$");
	const body = (anchored ? pattern.slice(0, -1) : pattern)
		.split("*")
		.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join(".*");
	return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

export function parseRobots(text: string): Robots {
	const groups: Group[] = [];
	let current: Group | null = null;
	let collectingAgents = false;
	for (const raw of text.split(/\r?\n/).slice(0, 5000)) {
		const line = raw.replace(/#.*$/, "").trim();
		const colon = line.indexOf(":");
		if (colon === -1) continue;
		const key = line.slice(0, colon).trim().toLowerCase();
		const value = line.slice(colon + 1).trim();
		if (key === "user-agent") {
			if (!current || !collectingAgents) {
				current = { agents: [], rules: [] };
				groups.push(current);
			}
			current.agents.push(value.toLowerCase());
			collectingAgents = true;
		} else if (key === "allow" || key === "disallow") {
			collectingAgents = false;
			if (!current || !value) continue;
			current.rules.push({ allow: key === "allow", pattern: value, matcher: toMatcher(value) });
		}
	}
	return { groups };
}

export function robotsAllows(robots: Robots, userAgent: string, path: string): boolean {
	const agent = userAgent.toLowerCase();
	let groups = robots.groups.filter((g) => g.agents.includes(agent));
	if (groups.length === 0) groups = robots.groups.filter((g) => g.agents.includes("*"));
	let best: Rule | null = null;
	for (const rule of groups.flatMap((g) => g.rules)) {
		if (!rule.matcher.test(path)) continue;
		if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule;
	}
	return best ? best.allow : true;
}
