import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../src/config.ts";

const env = {
	GRAPH_HOST: "falkordb", GRAPH_PORT: "6379", GRAPH_NAME: "brainee_dev",
	GRAPH_APP_PASSWORD: "a".repeat(64), GRAPH_SERVICE_TOKEN: "b".repeat(64),
};
test("only explicit local graph configuration is accepted", () => {
	assert.equal(readConfig(env).graphName, "brainee_dev");
	for (const patch of [
		{ GRAPH_NAME: "customer_supplied" }, { GRAPH_NAME: "brainee_test_../dev" },
		{ GRAPH_PORT: "6379x" }, { GRAPH_APP_PASSWORD: "" }, { GRAPH_SERVICE_TOKEN: "short" },
	]) assert.throws(() => readConfig({ ...env, ...patch }));
	assert.equal(readConfig({ ...env, GRAPH_NAME: "brainee_test_abc" }).graphName, "brainee_test_abc");
});
