import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./app.css";
import { Component, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Button } from "@/components/ui/button-clean";
import { EmptyState } from "@/components/ui/empty-state-clean";
import { applyTheme, storedTheme } from "./theme";

class Safety extends Component<{ children: ReactNode }, { broken: boolean }> {
	override state = { broken: false };
	static getDerivedStateFromError() {
		return { broken: true };
	}
	override render() {
		if (!this.state.broken) return this.props.children;
		return (
			<div className="oa-broken">
				<EmptyState tall title="This page stopped working" text="Your data is safe. Reload to carry on; if it happens again, please report it." action={<Button onClick={() => window.location.reload()}>Reload</Button>} />
			</div>
		);
	}
}

applyTheme(storedTheme());
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(storedTheme()));

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<StrictMode>
			<Safety>
				<App />
			</Safety>
		</StrictMode>,
	);
}
