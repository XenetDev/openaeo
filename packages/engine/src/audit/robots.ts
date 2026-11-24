type Rule = { allow: boolean; pattern: string };
type Group = { agents: string[]; rules: Rule[] };
export type Robots = { groups: Group[] };

function matches(pattern: string, path: string): boolean {
	const anchored = pattern.endsWith("$");
	const glob = anchored ? pattern.slice(0, -1) : pattern;
	let p = 0;
	let s = 0;
	let star = -1;
	let mark = 0;
	while (s < path.length) {
		if (p < glob.length && glob[p] === "*") {
			star = p;
			mark = s;
			p += 1;
		} else if (p < glob.length && glob[p] === path[s]) {
			p += 1;
			s += 1;
		} else if (p === glob.length && !anchored) {
			return true;
		} else if (star !== -1) {
			p = star + 1;
			mark += 1;
			s = mark;
		} else {
			return false;
		}
	}
	while (p < glob.length && glob[p] === "*") p += 1;
	return p === glob.length;
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
			current.rules.push({ allow: key === "allow", pattern: value.slice(0, 500) });
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
		if (!matches(rule.pattern, path)) continue;
		if (
			!best ||
			rule.pattern.length > best.pattern.length ||
			(rule.pattern.length === best.pattern.length && rule.allow)
		)
			best = rule;
	}
	return best ? best.allow : true;
}
