import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswerText } from "../src/AnswerText";

const html = (text: string, brand = ["Pipedrive"], others = ["HubSpot"]) => renderToStaticMarkup(<AnswerText text={text} brand={brand} others={others} />);

test("bold markers become bold text and mentions inside stay highlighted", () => {
	const out = html("**HubSpot** is the default. **Pipedrive** is cheaper.");
	expect(out).not.toContain("**");
	expect(out).toMatch(/<strong><mark[^>]*data-brand="false"[^>]*>HubSpot<\/mark><\/strong>/);
	expect(out).toMatch(/<strong><mark[^>]*data-brand="true"[^>]*>Pipedrive<\/mark><\/strong>/);
});

test("a markdown table becomes a real table without the separator row", () => {
	const out = html("| CRM | Why |\n|---|---|\n| **Pipedrive** | Simple |\n| HubSpot | Free tier |");
	expect(out).toContain("<table");
	expect(out).toContain("<th>CRM</th>");
	expect(out).toMatch(/<td><strong><mark[^>]*>Pipedrive<\/mark><\/strong><\/td>/);
	expect(out).toContain("<td>Free tier</td>");
	expect(out).not.toContain("---");
	expect(out).not.toContain("|");
});

test("headings, bullet lists and numbered lists are structured", () => {
	const out = html("## Shortlist\n\n- Pipedrive for sales\n- HubSpot for inbound\n\n1. First\n2. Second\n\nClosing line\nwraps here.");
	expect(out).toContain("<h3");
	expect(out).toContain("Shortlist");
	expect(out).toMatch(/<ul[^>]*><li>.*Pipedrive.* for sales<\/li><li>/);
	expect(out).toMatch(/<ol[^>]*><li>First<\/li><li>Second<\/li><\/ol>/);
	expect(out).toContain("<p>Closing line wraps here.</p>");
	expect(out).not.toContain("##");
});

test("links keep their text and only http links are clickable", () => {
	const out = html("See [the pricing page](https://pipedrive.com/pricing) and [bad](javascript:alert(1)).");
	expect(out).toContain('<a href="https://pipedrive.com/pricing" target="_blank" rel="noreferrer noopener">the pricing page</a>');
	expect(out).not.toContain("javascript:");
	expect(out).toContain("bad");
});

test("inline code is shown as code and html stays escaped", () => {
	const out = html("Run `npm i` then <img src=x onerror=alert(1)> **<b>x</b>**");
	expect(out).toContain("<code>npm i</code>");
	expect(out).not.toContain("<img");
	expect(out).not.toContain("<b>");
	expect(out).toContain("&lt;img");
});

test("unbalanced markers and odd input do not break rendering", () => {
	expect(html("**never closed and | a pipe | mid sentence")).toContain("never closed");
	expect(html("")).toBe('<div class="oa-answer-text"></div>');
	expect(html("|\n|\n")).not.toContain("undefined");
	expect(html("* single star item\n* second")).toMatch(/<ul/);
});

test("a very long answer renders quickly", () => {
	const long = "| A | B |\n|---|---|\n" + "| **Pipedrive** | text HubSpot |\n".repeat(4000) + "\n" + "Paragraph with **bold** and [l](https://a.com). ".repeat(4000);
	const started = Date.now();
	expect(html(long).length).toBeGreaterThan(1000);
	expect(Date.now() - started).toBeLessThan(2500);
});
