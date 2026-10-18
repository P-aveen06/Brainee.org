import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "../vite.config";

const expectedTanstackEntries = {
	"#tanstack-router-entry": fileURLToPath(
		new URL("./router.tsx", import.meta.url),
	),
	"#tanstack-start-entry": fileURLToPath(
		new URL("./start.ts", import.meta.url),
	),
};

describe("Vite dependency optimizer", () => {
	it("resolves TanStack Start entries in both client and SSR scans", () => {
		expect(config.optimizeDeps?.exclude).toContain(
			"@tanstack/start-server-core",
		);
		expect(config.optimizeDeps?.rolldownOptions?.resolve?.alias).toMatchObject(
			expectedTanstackEntries,
		);
		expect(config.ssr?.optimizeDeps?.exclude).toContain(
			"@tanstack/start-server-core",
		);
		expect(
			config.ssr?.optimizeDeps?.rolldownOptions?.resolve?.alias,
		).toMatchObject(expectedTanstackEntries);
	});
});
