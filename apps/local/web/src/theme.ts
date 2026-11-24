export type Theme = "System" | "Light" | "Dark";

const KEY = "openaeo.theme";

export function storedTheme(): Theme {
	const value = window.localStorage.getItem(KEY);
	return value === "Light" || value === "Dark" ? value : "System";
}

export function applyTheme(theme: Theme): void {
	const dark = theme === "Dark" || (theme === "System" && window.matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", dark);
}

export function saveTheme(theme: Theme): void {
	if (theme === "System") window.localStorage.removeItem(KEY);
	else window.localStorage.setItem(KEY, theme);
	applyTheme(theme);
}
