import type { SettingsResponse } from "../../api-types";
import type { HandlerDeps } from "../handler";
import { json, read } from "../http";
import { type Route, route } from "../router";
import { MASK, SECRET_SETTINGS, SettingsSchema } from "../schemas";

export function settingsRoutes({ store }: HandlerDeps): Route[] {
	const masked = (): SettingsResponse => {
		const settings = store.settings.all();
		for (const key of SECRET_SETTINGS) {
			const value = settings[key];
			if (value) settings[key] = `${MASK}${value.slice(-4)}`;
		}
		return { settings };
	};

	return [
		route("GET", "/api/settings", () => json(masked())),
		route("PUT", "/api/settings", async ({ request }) => {
			const input = await read(request, SettingsSchema);
			for (const [key, value] of Object.entries(input)) {
				if (value === undefined) continue;
				if (SECRET_SETTINGS.has(key) && value.startsWith(MASK)) continue;
				if (value === "") store.settings.remove(key);
				else store.settings.set(key, value);
			}
			return json(masked());
		}),
	];
}
