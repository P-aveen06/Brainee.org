import { FalkorDB } from "falkordb";
import type { GraphConfig } from "./config.ts";

export async function connect(config: GraphConfig, adminPassword?: string) {
	const options = {
		socket: {
			host: config.host,
			port: config.port,
			connectTimeout: 3000,
			reconnectStrategy: false as const,
		},
		username: adminPassword ? "admin" : "app",
		password: adminPassword ?? config.password,
		disableOfflineQueue: true,
		commandsQueueMaxLength: 64,
		commandOptions: { timeout: 5000 },
	};
	const client = await FalkorDB.connect(options);
	// Never print driver errors, which may include connection details or queries.
	client.on("error", () => console.error("Graph connection unavailable."));
	return client;
}
