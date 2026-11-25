import { runtime } from "./runtime";

type Words = {
	lost: string;
	host: string;
	enginesIntro: string;
	engineReady: string;
	previewEngines: string;
	settingsEngines: string;
	noEngine: string;
	askNoEngine: string;
	askSource: string;
	askBy: (engine: string) => string;
	schedule: string;
};

const LOCAL: Words = {
	lost: "OpenAEO stopped responding. Check that it is still running in your terminal, then reload this page.",
	host: "Runs on this computer",
	enginesIntro:
		"OpenAEO asks each one your buyers' questions. Use the subscriptions on this computer, or add API keys. Keys stay on this computer.",
	engineReady: "API key saved",
	previewEngines: "The tools signed in on this computer",
	settingsEngines: "OpenAEO asks the AI tools signed in on this computer, and any provider you add a key for below.",
	noEngine: "OpenAEO uses the AI tools signed in on this computer.",
	askNoEngine: "Aeo uses your own Claude Code or Codex. Install and sign in to one, then check Settings.",
	askSource: "Written by your own Claude or Codex from your runs and site audit, not from the web.",
	askBy: (engine) => `Written by ${engine} on your own subscription,`,
	schedule: "Automatic runs only happen while OpenAEO is open on this computer.",
};

const CLOUD: Words = {
	lost: "OpenAEO stopped responding. Check your connection, then reload this page.",
	host: "OpenAEO Cloud",
	enginesIntro: "OpenAEO asks each one your buyers' questions. These engines are included with your plan.",
	engineReady: "Included",
	previewEngines: "The engines OpenAEO asks",
	settingsEngines: "OpenAEO asks every engine switched on here.",
	noEngine: "Switch an engine on in Settings to start.",
	askNoEngine: "Aeo needs an engine. Switch one on in Settings.",
	askSource: "Written from your runs and site audit, not from the web.",
	askBy: (engine) => `Written by ${engine},`,
	schedule: "Scheduled runs are not available on OpenAEO Cloud yet.",
};

export const words: Words = runtime.cloud ? CLOUD : LOCAL;
