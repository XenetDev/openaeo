import { expect, test } from "bun:test";
import { type Entity, match } from "../src/match";
import type { Source } from "../src/types";

const answer = (text: string, citations: Source[] = [], sources: Source[] = []) => ({ text, citations, sources });
const src = (url: string, domain: string): Source => ({ url, domain });

const pipedrive: Entity = { name: "Pipedrive", domains: ["pipedrive.com"] };
const hubspot: Entity = { name: "HubSpot" };
const attio: Entity = { name: "Attio" };

test("ranks entities by first appearance and counts mentions", () => {
	const result = match(answer("**HubSpot** is the default. Pipedrive is cheaper; HubSpot's paid tiers add up."), pipedrive, [hubspot, attio]);
	expect(result.mentions.map((m) => [m.entity, m.rank, m.count])).toEqual([
		["HubSpot", 1, 2],
		["Pipedrive", 2, 1],
	]);
	expect(result.mentions[0]?.firstIndex).toBe(2);
	expect(result.brandMentioned).toBe(true);
	expect(result.brandRank).toBe(2);
});

test("does not match a name inside a longer word", () => {
	const result = match(answer("In the beginning, bigin-like tools were rare. Rebigin is unrelated."), { name: "Bigin" }, []);
	expect(result.mentions).toEqual([{ entity: "Bigin", rank: 1, firstIndex: 18, count: 1 }]);
});

test("a longer tracked name wins over a shorter one inside it", () => {
	const result = match(answer("HubSpot CRM is popular."), { name: "HubSpot CRM" }, [hubspot]);
	expect(result.mentions.map((m) => m.entity)).toEqual(["HubSpot CRM"]);
});

test("the shorter name still counts where it stands alone", () => {
	const result = match(answer("HubSpot CRM is popular, and HubSpot also sells marketing tools."), { name: "HubSpot CRM" }, [hubspot]);
	expect(result.mentions.map((m) => [m.entity, m.count])).toEqual([
		["HubSpot CRM", 1],
		["HubSpot", 1],
	]);
});

test("aliases count towards the entity's name", () => {
	const brand: Entity = { name: "GoHighLevel", aliases: ["HighLevel", "GHL"] };
	const result = match(answer("GHL suits agencies. HighLevel has white-labelling."), brand, [hubspot]);
	expect(result.brandMentioned).toBe(true);
	expect(result.mentions).toEqual([{ entity: "GoHighLevel", rank: 1, firstIndex: 0, count: 2 }]);
});

test("a name that only appears inside a URL is not a mention", () => {
	const result = match(answer("See https://pipedrive.com/pricing and [pricing](https://www.pipedrive.com/en/pricing)."), pipedrive, []);
	expect(result.brandMentioned).toBe(false);
	expect(result.brandRank).toBeNull();
});

test("matching ignores case and curly apostrophes", () => {
	expect(match(answer("hubspot’s tiers"), hubspot, []).brandMentioned).toBe(true);
	expect(match(answer("HUBSPOT"), hubspot, []).brandMentioned).toBe(true);
});

test("names with punctuation match literally", () => {
	expect(match(answer("We like C++ CRM a lot"), { name: "C++ CRM" }, []).brandMentioned).toBe(true);
	expect(match(answer("Try monday.com today"), { name: "monday.com" }, []).brandMentioned).toBe(true);
	expect(match(answer("On mondayXcom"), { name: "monday.com" }, []).brandMentioned).toBe(false);
});

test("non-latin names match", () => {
	expect(match(answer("推荐使用飞书进行协作"), { name: "飞书" }, []).brandMentioned).toBe(true);
	expect(match(answer("Wir nutzen Müller CRM."), { name: "Müller CRM" }, []).brandMentioned).toBe(true);
});

test("blank names and aliases are ignored", () => {
	const result = match(answer("Anything at all"), { name: " ", aliases: ["", "  "] }, [{ name: "" }]);
	expect(result.mentions).toEqual([]);
});

test("the same entity listed twice is reported once", () => {
	const result = match(answer("HubSpot wins"), hubspot, [{ name: "hubspot" }]);
	expect(result.mentions.length).toBe(1);
	expect(result.mentions[0]?.count).toBe(1);
});

test("brandCited is true for a citation on the brand's site or subdomain", () => {
	const result = match(answer("x", [src("https://blog.pipedrive.com/a", "blog.pipedrive.com")]), pipedrive, []);
	expect(result.brandCited).toBe(true);
	expect(result.brandSourced).toBe(true);
	expect(result.citedDomains).toEqual(["blog.pipedrive.com"]);
});

test("brandSourced without brandCited when the brand is only in search results", () => {
	const result = match(answer("x", [src("https://a.com/1", "a.com"), src("https://a.com/2", "a.com")], [src("https://pipedrive.com/p", "pipedrive.com")]), pipedrive, []);
	expect(result.brandCited).toBe(false);
	expect(result.brandSourced).toBe(true);
	expect(result.citedDomains).toEqual(["a.com"]);
});

test("a lookalike domain is not the brand's", () => {
	const result = match(answer("x", [src("https://notpipedrive.com/", "notpipedrive.com")]), pipedrive, []);
	expect(result.brandCited).toBe(false);
});

test("brand domains given as URLs or with www still match", () => {
	const brand: Entity = { name: "Pipedrive", domains: ["https://www.Pipedrive.com/"] };
	expect(match(answer("x", [src("https://pipedrive.com/p", "pipedrive.com")]), brand, []).brandCited).toBe(true);
});

test("empty text gives no mentions", () => {
	const result = match(answer(""), pipedrive, [hubspot]);
	expect(result.mentions).toEqual([]);
	expect(result.brandMentioned).toBe(false);
	expect(result.brandRank).toBeNull();
	expect(result.brandCited).toBe(false);
});
