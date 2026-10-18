import assert from "node:assert/strict";
import { readConfig } from "../src/config.ts";
import { connect } from "../src/connection.ts";
import { checkReady, migrate } from "../src/migrations.ts";

const config = readConfig(process.env);
assert.match(config.graphName, /^brainee_test_recovery_[a-f0-9]{32}$/);
const password = process.env.GRAPH_ADMIN_PASSWORD;
assert.ok(password);
const action = process.argv[2];
assert.ok(["prepare", "verify", "cleanup"].includes(action));
const client = await connect(config, password);
const graph = client.selectGraph(config.graphName);
try {
	if (action === "cleanup") await graph.delete();
	else if (action === "prepare") {
		await migrate(graph);
		await graph.query("CREATE (:Task {id:'recovery-fixture',projectId:'recovery-project',taskNumber:1,status:'todo',priority:'medium',sequence:0, title:'Recovery check', estimateHours:1.5, dueDate:'2026-10-21'})");
	} else {
		await checkReady(graph);
		const { data } = await graph.roQuery<{id: string; hours: number; due: string}>(
			"MATCH (t:Task {id:'recovery-fixture'}) RETURN t.id AS id, t.estimateHours AS hours, t.dueDate AS due",
		);
		assert.deepEqual(data, [{ id: "recovery-fixture", hours: 1.5, due: "2026-10-21" }]);
	}
} finally { await client.close(); }
