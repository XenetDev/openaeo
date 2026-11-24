import { expect, test } from "bun:test";
import { barColors, OTHERS, OWN } from "../web/src/screens/palette";

test("your own row is always the brand colour", () => {
	const colors = barColors([{ name: "Rival" }, { name: "Xenet", own: true }]);
	expect(colors[1]).toBe(OWN);
	expect(colors[0]).not.toBe(OWN);
});

test("a name keeps its colour when the order of the list changes", () => {
	const rows = [{ name: "AI Fund" }, { name: "Hexa" }, { name: "Atomic" }, { name: "Xenet", own: true }];
	const before = barColors(rows);
	const after = barColors([...rows].reverse()).reverse();
	expect(after).toEqual(before);
});

test("rows in one list do not share a colour while the palette lasts", () => {
	const names = ["AI Fund", "Hexa", "Atomic", "High Alpha", "Founders Factory", "Antler"].map((name) => ({ name }));
	const colors = barColors(names);
	expect(new Set(colors).size).toBe(names.length);
	expect(colors.every((color) => OTHERS.includes(color))).toBe(true);
});

test("a list longer than the palette reuses colours instead of failing", () => {
	const colors = barColors(Array.from({ length: OTHERS.length + 3 }, (_, i) => ({ name: `Brand ${i}` })));
	expect(colors.length).toBe(OTHERS.length + 3);
	expect(colors.every((color) => OTHERS.includes(color))).toBe(true);
});
