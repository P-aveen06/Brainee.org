import { operations } from "./operations.ts";
import { readConfig } from "./config.ts";
import { connect } from "./connection.ts";
import { createGraphServer } from "./http.ts";
import { checkReady } from "./migrations.ts";

const config = readConfig(process.env);
const client = await connect(config);
const graph = client.selectGraph(config.graphName);
await checkReady(graph);
const server = createGraphServer(
	config.serviceToken,
	() => checkReady(graph),
	operations(graph),
);
client.once("error", () => {
	// Restart with a fresh connection rather than queue requests after a disconnect.
	server.close();
	process.exit(1);
});
server.listen(3100, "0.0.0.0", () =>
	console.log("Graph service listening on port 3100."),
);

function shutdown() {
	server.close(async () => {
		await client.close();
		process.exit(0);
	});
	setTimeout(() => process.exit(1), 5000).unref();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
