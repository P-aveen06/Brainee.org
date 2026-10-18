import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const tanstackEntryAliases = {
	"#tanstack-router-entry": fileURLToPath(
		new URL("./src/router.tsx", import.meta.url),
	),
	"#tanstack-start-entry": fileURLToPath(
		new URL("./src/start.ts", import.meta.url),
	),
};

// Dependency optimization runs before TanStack's normal resolve aliases apply.
const dependencyOptimizerOptions = {
	exclude: ["@tanstack/start-server-core"],
	rolldownOptions: {
		resolve: { alias: tanstackEntryAliases },
	},
};

const config = defineConfig(({ command, isPreview }) => ({
	resolve: { tsconfigPaths: true },
	optimizeDeps: dependencyOptimizerOptions,
	ssr: { optimizeDeps: dependencyOptimizerOptions },
	plugins: [
		devtools(),
		cloudflare({
			viteEnvironment: { name: "ssr" },
			config:
				command === "serve" && !isPreview
					? (workerConfig) => {
							// Use the bundled runtime's default date during local development.
							delete workerConfig.compatibility_date;
						}
					: undefined,
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
}));

export default config;
