import type { SettingsResponse } from "../../api-types";
import type { ApiDeps } from "../api";
import { json, read } from "../http";
import { type Route, route } from "../router";
import { MASK, SECRET_SETTINGS, SettingsSchema } from "../schemas";

export function settingsRoutes({ store }: ApiDeps): Route[] {
	const masked = async (): Promise<SettingsResponse> => {
		const settings = await store.settings.all();
		for (const key of SECRET_SETTINGS) {
			const value = settings[key];
			if (value) settings[key] = `${MASK}${value.slice(-4)}`;
		}
		return { settings };
	};

	return [
		route("GET", "/api/settings", async () => json(await masked())),
		route("PUT", "/api/settings", async ({ request }) => {
			const input = await read(request, SettingsSchema);
			for (const [key, value] of Object.entries(input)) {
				if (value === undefined) continue;
				if (SECRET_SETTINGS.has(key) && value.startsWith(MASK)) continue;
				if (value === "") await store.settings.remove(key);
				else await store.settings.set(key, value);
			}
			return json(await masked());
		}),
	];
}
