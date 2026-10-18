import { readConfig } from "./config.ts";
import { connect } from "./connection.ts";
import { migrate } from "./migrations.ts";

const config = readConfig(process.env);
const password = process.env.GRAPH_ADMIN_PASSWORD;
if (!password || password.length < 32)
	throw new Error("Migration requires graph administrator credentials.");
const client = await connect(config, password);
try {
	await migrate(client.selectGraph(config.graphName));
	console.log(
		"Graph identity and business schemas are ready. No sample records were created.",
	);
} finally {
	await client.close();
}
