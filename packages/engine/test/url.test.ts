import { expect, test } from "bun:test";
import { extractUrls, normalizeUrl, sameSite, toDomain, toSource } from "../src/url";

test("normalizeUrl strips a trailing HTML entity", () => {
	expect(normalizeUrl("https://techradar.com/best/crm&quot")).toBe("https://techradar.com/best/crm");
	expect(normalizeUrl("https://techradar.com/best/crm&quot;")).toBe("https://techradar.com/best/crm");
});

test("normalizeUrl strips tracking parameters and the fragment", () => {
	expect(normalizeUrl("https://a.com/x?utm_source=y&id=2&fp_ref=z#frag")).toBe("https://a.com/x?id=2");
	expect(normalizeUrl("https://a.com/x?fr=operanews&gclid=1&fbclid=2&ref=3")).toBe("https://a.com/x");
});

test("normalizeUrl strips trailing punctuation", () => {
	expect(normalizeUrl("https://a.com/x).")).toBe("https://a.com/x");
	expect(normalizeUrl("https://a.com/x,")).toBe("https://a.com/x");
});

test("normalizeUrl rejects non-http and unparseable input", () => {
	expect(normalizeUrl("ftp://a.com")).toBeNull();
	expect(normalizeUrl("not a url")).toBeNull();
	expect(normalizeUrl("")).toBeNull();
});

test("normalizeUrl keeps a bare origin without a trailing slash difference", () => {
	expect(normalizeUrl("https://a.com")).toBe("https://a.com/");
	expect(normalizeUrl("https://a.com/")).toBe("https://a.com/");
});

test("extractUrls returns normalised unique urls in order", () => {
	const text = "See [Attio](https://attio.com/f/best). Also https://attio.com/f/best, and (https://b.io/x).";
	expect(extractUrls(text)).toEqual(["https://attio.com/f/best", "https://b.io/x"]);
});

test("extractUrls returns an empty list for text without urls", () => {
	expect(extractUrls("no links here")).toEqual([]);
});

test("toDomain lower-cases and drops www", () => {
	expect(toDomain("https://WWW.HubSpot.com/pricing")).toBe("hubspot.com");
	expect(toDomain("nope")).toBeNull();
});

test("sameSite matches the site and its subdomains only", () => {
	expect(sameSite("blog.hubspot.com", "hubspot.com")).toBe(true);
	expect(sameSite("hubspot.com", "hubspot.com")).toBe(true);
	expect(sameSite("HubSpot.com", "www.hubspot.com")).toBe(true);
	expect(sameSite("nothubspot.com", "hubspot.com")).toBe(false);
	expect(sameSite("hubspot.com", "blog.hubspot.com")).toBe(false);
});

test("toSource builds a source with a domain and optional title", () => {
	expect(toSource("https://www.a.com/x?utm_campaign=1", "A")).toEqual({
		url: "https://www.a.com/x",
		domain: "a.com",
		title: "A",
	});
	expect(toSource("https://a.com/x")).toEqual({ url: "https://a.com/x", domain: "a.com" });
	expect(toSource("junk")).toBeNull();
});
