import assert from "node:assert/strict";
import test from "node:test";
import type { Graph } from "falkordb";
import { deliveryOperation } from "../src/delivery-retrieval.ts";
import { createGraphServer } from "../src/http.ts";

const employee = { id: "employee", role: "employee", storedRole: "employee" } as const;

test("delivery boundary rejects arbitrary operations and actor injection", async () => {
	const graph = {} as Graph;
	await assert.rejects(deliveryOperation(graph, "delivery.cypher", {}, employee));
	await assert.rejects(deliveryOperation(graph, "delivery.search", { query: "payment", actorId: "admin" }, employee));
	await assert.rejects(deliveryOperation(graph, "delivery.document_manifest", {}, employee));
	await assert.rejects(deliveryOperation(graph, "delivery.index_queue", {}, employee));
	await assert.rejects(deliveryOperation(graph, "delivery.index_failure", { documentId: "doc" }, employee));
});

test("document stream route requires token, signed subject and bounded body", async () => {
	let seen = "";
	const server = createGraphServer("token", async () => {}, undefined, async (subject, id, request) => {
		for await (const chunk of request) seen += chunk.toString();
		return { subject, id };
	});
	await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	const url = `http://127.0.0.1:${address.port}/delivery/documents/doc/index`;
	try {
		assert.equal((await fetch(url, { method: "POST", body: "payment" })).status, 401);
		assert.equal((await fetch(url, { method: "POST", headers: { authorization: "Bearer token" }, body: "payment" })).status, 400);
		const response = await fetch(url, { method: "POST", headers: { authorization: "Bearer token", "x-graph-subject": "signed-subject" }, body: "payment" });
		assert.equal(response.status, 200);
		assert.equal(seen, "payment");
		assert.deepEqual(await response.json(), { data: { subject: "signed-subject", id: "doc" } });
	} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
