import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: import.meta.dirname,
	plugins: [react()],
	resolve: {
		alias: {
			"@api": resolve(import.meta.dirname, "../src/api-types.ts"),
			"@": resolve(import.meta.dirname, "src"),
		},
	},
	build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0 },
});
