import assert from "node:assert/strict";
import test from "node:test";
import { constraints, constraintsReady, tableLabels } from "../src/schema.ts";

test("readiness rejects missing, building, and failed constraints", () => {
	const ready = constraints.map(c => ({
		type: c.type, label: c.label, properties: [c.property], status: "OPERATIONAL",
	}));
	assert.equal(constraintsReady(ready), true);
	assert.equal(constraintsReady(ready.slice(1)), false);
	for (const status of ["PENDING", "UNDER CONSTRUCTION", "FAILED"]) {
		assert.equal(constraintsReady(ready.map((r, i) => i === 0 ? { ...r, status } : r)), false);
	}
	assert.equal(Object.keys(tableLabels).length, 37);
});
