import "@fontsource/instrument-serif/400.css";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "@openaeo/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
}
