import { expect, test } from "bun:test";
import { toAnswerMarkup } from "../web/src/screens/answer-markup";

const cite = (url: string, title?: string) => ({ url, domain: new URL(url).hostname.replace(/^www\./, ""), title });

test("links become numbered citations that point at the sources", () => {
	const out = toAnswerMarkup(
		"Linear is fast. [Linear pricing](https://linear.app/pricing) and [Jira](https://atlassian.com/jira).",
		[cite("https://linear.app/pricing", "Pricing")],
		[],
	);
	expect(out.answer).toBe("Linear is fast. Linear pricing [1] and Jira [2].");
	expect(out.sources).toEqual([
		{ title: "Pricing", name: "linear.app", href: "https://linear.app/pricing" },
		{ title: "atlassian.com", name: "atlassian.com", href: "https://atlassian.com/jira" },
	]);
});

test("the same link cited twice reuses its number, and unsafe links keep only their text", () => {
	const out = toAnswerMarkup("[a](https://x.com/1) then [b](https://x.com/1) and [bad](javascript:alert(1))", [], []);
	expect(out.answer).toBe("a [1] then b [1] and bad");
	expect(out.sources.length).toBe(1);
});

test("a bare address becomes a citation", () => {
	const out = toAnswerMarkup("See https://linear.app/docs for more.", [], []);
	expect(out.answer).toBe("See [1] for more.");
	expect(out.sources[0]?.href).toBe("https://linear.app/docs");
});

test("a table becomes a list with the first cell in bold", () => {
	const out = toAnswerMarkup(
		"Options:\n\n| Tool | When | Tradeoff |\n|---|---|---|\n| **Linear** | Small teams | Per-user price |\n| Jira | Compliance | Setup time |",
		[],
		[],
	);
	expect(out.answer).toBe(
		"Options:\n\n- **Linear**: Small teams · Per-user price\n- **Jira**: Compliance · Setup time",
	);
});

test("headings become bold lines and numbered or starred lists become plain lists", () => {
	const out = toAnswerMarkup("## Default pick\nLinear.\n\n1. Fast\n2) Simple\n* Cheap\n\n---\nDone", [], []);
	expect(out.answer).toBe("**Default pick**\n\nLinear.\n\n- Fast\n- Simple\n- Cheap\n\nDone");
});

test("the brand is put in bold where it is not already", () => {
	const out = toAnswerMarkup("Linear is good. **Linear wins** overall, and linearly is a word.", [], ["Linear"]);
	expect(out.answer).toBe("**Linear** is good. **Linear wins** overall, and linearly is a word.");
});

test("empty and odd input is safe", () => {
	expect(toAnswerMarkup("", [], ["X"])).toEqual({ answer: "", sources: [] });
	expect(toAnswerMarkup("|\n|\n", [], []).answer).toBe("");
	expect(() => toAnswerMarkup("[unclosed](http://", [], ["("])).not.toThrow();
});

test("citations given but never linked in the text are still listed as sources", () => {
	const out = toAnswerMarkup("Plain answer.", [cite("https://g2.com/x", "G2 list")], []);
	expect(out.sources).toEqual([{ title: "G2 list", name: "g2.com", href: "https://g2.com/x" }]);
});

test("a list directly under a line of text is separated from it, and from what follows", () => {
	const out = toAnswerMarkup(
		"**My recommendation:**\n- For a small team, use Notion.\n- For control, use Outline.\nPrices change often.",
		[],
		[],
	);
	expect(out.answer).toBe(
		"**My recommendation:**\n\n- For a small team, use Notion.\n- For control, use Outline.\n\nPrices change often.",
	);
});

test("indented sub-items stay list items", () => {
	const out = toAnswerMarkup("Compare:\n  - Search quality\n  - Permissions", [], []);
	expect(out.answer).toBe("Compare:\n\n- Search quality\n- Permissions");
});

test("drops a closing list of sources, since the cards already show them", () => {
	const out = toAnswerMarkup(
		"Pick Acme.\n\nSources:\n- [Acme pricing](https://acme.com/pricing)\n- https://example.org/review",
		[],
		[],
	);
	expect(out.answer).toBe("Pick Acme.");
	expect(out.sources.map((s) => s.href)).toEqual(["https://acme.com/pricing", "https://example.org/review"]);
});

test("keeps a sources heading that is followed by more prose", () => {
	const out = toAnswerMarkup("**Sources:**\n- https://acme.com\n\nSo pick Acme.", [], []);
	expect(out.answer).toContain("Sources:");
	expect(out.answer).toContain("So pick Acme.");
});

test("a link inside bold text still becomes a citation chip", () => {
	const out = toAnswerMarkup("**My pick is [Acme](https://acme.com) in Cape Town.**", [], []);
	expect(out.answer).toBe("**My pick is Acme** [1] **in Cape Town.**");
});
