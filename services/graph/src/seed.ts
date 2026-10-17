import { readConfig } from "./config.ts";
import { connect } from "./connection.ts";
import { checkReady } from "./migrations.ts";
import { seedSampleData } from "./sample-data.ts";
const config = readConfig(process.env);
if (config.graphName !== "brainee_dev")
	throw new Error("Sample seeding is restricted to brainee_dev.");
const client = await connect(config);
try {
	const graph = client.selectGraph(config.graphName);
	await checkReady(graph);
	console.log(JSON.stringify(await seedSampleData(graph), null, 2));
} finally {
	await client.close();
}
