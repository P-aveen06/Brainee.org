import assert from "node:assert/strict";
import test from "node:test";
import { createGraphServer } from "../src/http.ts";

test("readiness requires authentication and reports failures without details", async () => {
	let available = true;
	let calls = 0;
	const server = createGraphServer("test-token", async () => {
		calls++;
		if (!available) throw new Error("password=must-never-appear");
	});
	await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	const base = `http://127.0.0.1:${address.port}`;
	const headers = { authorization: "Bearer test-token" };
	try {
		assert.equal((await fetch(`${base}/health`)).status, 200);
		assert.equal((await fetch(`${base}/ready`)).status, 401);
		assert.equal(calls, 0);
		assert.equal((await fetch(`${base}/ready`, { headers })).status, 200);
		assert.equal((await fetch(`${base}/query`, { headers })).status, 404);
		assert.equal((await fetch(`${base}/ready`, { headers, method: "POST" })).status, 405);
		available = false;
		const failed = await fetch(`${base}/ready`, { headers });
		assert.equal(failed.status, 503);
		assert.doesNotMatch(await failed.text(), /password/);
	} finally {
		server.closeAllConnections();
		await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
	}
});
