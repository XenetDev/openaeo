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
	firstRun: string;
	settingsSub: string;
	engineNote: string;
	scheduleNote: string;
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
	scheduleNote: "While OpenAEO is open",
	firstRun:
		"This runs on your own engines and takes a few minutes. You can open the dashboard at any time; it keeps going.",
	settingsSub: "Engines, your agent connection and the brand you track.",
	engineNote:
		"Each engine is asked through its own tool with web search on. Results can differ from the consumer apps.",
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
	schedule: "Runs happen on their own, even when OpenAEO is closed.",
	scheduleNote: "Even when OpenAEO is closed",
	firstRun: "This takes a few minutes. You can open the dashboard at any time; it keeps going.",
	settingsSub: "Your brand, account, workspace and billing.",
	engineNote: "Each engine is asked through its API with web search on. Results can differ from the consumer apps.",
};

export const words: Words = runtime.cloud ? CLOUD : LOCAL;
