import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
	resolve: {
		alias: {
			"cloudflare:workers": path.resolve(
				__dirname,
				"./test/cloudflare-workers-stub.ts",
			),
			"@": path.resolve(__dirname, "./src"),
			"#": path.resolve(__dirname, "./src"),
		},
	},
});
