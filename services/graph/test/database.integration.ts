import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { readConfig } from "../src/config.ts";
import { connect } from "../src/connection.ts";
import { checkReady, migrate } from "../src/migrations.ts";

test("real engine: clean migration, constraints, rollback, permissions and concurrency", async () => {
	const config = readConfig(process.env);
	const password = process.env.GRAPH_ADMIN_PASSWORD;
	assert.ok(password);
	const name = `brainee_test_${randomUUID().replaceAll("-", "")}`;
	const admin = await connect(config, password);
	const app = await connect(config);
	const graph = admin.selectGraph(name);
	const query = app.selectGraph(name);
	try {
		await migrate(graph);
		await migrate(graph);
		await checkReady(query);
		const empty = await graph.roQuery<{ count: number }>("MATCH (n:Employee) RETURN count(n) AS count");
		assert.equal(empty.data?.[0].count, 0);
		await query.query("CREATE (:Employee {id:'one', authId:'auth-one', emailKey:'one@example.test'})");
		await assert.rejects(query.query("CREATE (:Employee {id:'one', authId:'auth-two', emailKey:'two@example.test'})"));
		await assert.rejects(query.query("CREATE (:Employee {id:'missing-identity'})"));
		await assert.rejects(query.query("CREATE (:Task {id:'rolled-back'}) CREATE (:Employee {id:'one', authId:'other', emailKey:'other@example.test'})"));
		const undone = await query.roQuery<{ count: number }>("MATCH (t:Task {id:'rolled-back'}) RETURN count(t) AS count");
		assert.equal(undone.data?.[0].count, 0);
		const attempts = await Promise.allSettled(Array.from({ length: 8 }, () =>
			query.query("CREATE (:Task {id:'concurrent'})")));
		assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
		await assert.rejects(query.delete());
		await assert.rejects(app.selectGraph("unrelated_graph").query("CREATE (:Task {id:'forbidden'})"));
	} finally {
		// Only this randomly named disposable graph may be removed by this test.
		assert.match(name, /^brainee_test_[a-f0-9]{32}$/);
		try { await graph.delete(); } finally { await Promise.all([admin.close(), app.close()]); }
	}
});
