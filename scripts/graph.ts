import { backupGraph, verifyRestore } from "./graph-backup.ts";
import { compose } from "./graph-process.ts";
import { testRecovery } from "./graph-recovery.ts";
import { localSecrets, setupGraph } from "./graph-setup.ts";

const command = process.argv[2];
try {
	if (command === "setup") setupGraph();
	else {
		localSecrets();
		switch (command) {
			case "up":
				compose(["config", "--quiet"]);
				compose(["up", "-d", "--wait", "falkordb"]);
				compose(["run", "--rm", "--build", "graph-tools"]);
				compose(["up", "-d", "--build", "--wait", "graph-service"]);
				break;
			case "down": compose(["down"]); break; // Keep the data volume.
			case "status": compose(["ps"]); break;
			case "migrate": compose(["run", "--rm", "--build", "graph-tools"]); break;
			case "test":
				compose(["run", "--rm", "--build", "graph-tools", "node", "--experimental-strip-types", "--test", "test/database.integration.ts"]);
				break;
			case "health": {
				const response = await fetch("http://127.0.0.1:3100/ready", {
					headers: { authorization: `Bearer ${localSecrets().GRAPH_SERVICE_TOKEN}` },
					signal: AbortSignal.timeout(5000),
				});
				if (!response.ok) throw new Error("Graph service or schema is not ready.");
				console.log(await response.text());
				break;
			}
			case "test:recovery": await testRecovery(); break;
			case "backup": backupGraph(); break;
			case "restore-check": {
				const file = process.argv[3] ?? backupGraph();
				await verifyRestore(file);
				break;
			}
			default: throw new Error("Use setup, up, down, status, migrate, health, test, test:recovery, backup, or restore-check.");
		}
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : "Graph command failed.");
	process.exitCode = 1;
}
