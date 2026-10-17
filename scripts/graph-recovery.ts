import { randomUUID } from "node:crypto";
import { backupGraph, verifyRestore } from "./graph-backup.ts";
import { compose } from "./graph-process.ts";

export async function testRecovery() {
	const graph = `brainee_test_recovery_${randomUUID().replaceAll("-", "")}`;
	const probe = (action: string) => compose(["run", "--rm", "--build", "-e", `GRAPH_NAME=${graph}`,
		"graph-tools", "node", "--experimental-strip-types", "test/recovery-probe.ts", action]);
	let prepared = false;
	try {
		probe("prepare");
		prepared = true;
		compose(["down"]); // Only this Compose project; retain its named data volume.
		compose(["up", "-d", "--wait", "falkordb", "graph-service"]);
		probe("verify");
		await verifyRestore(backupGraph(), graph);
		console.log("Container recreation and isolated backup restore preserved the test record.");
	} finally {
		if (prepared) probe("cleanup");
	}
}
