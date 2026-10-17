import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { migrationChecksum } from "../services/graph/src/schema.ts";
import { compose, image, run } from "./graph-process.ts";

export function backupGraph() {
	mkdirSync(".local/backups/falkordb", { recursive: true, mode: 0o700 });
	const file = `graph-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.rdb`;
	const remote = `/var/lib/falkordb/data/${file}`;
	// --rdb requests a consistent server snapshot; do not copy a live AOF directory.
	compose(["exec", "-T", "falkordb", "redis-cli", "--user", "admin", "--rdb", remote]);
	const target = `.local/backups/falkordb/${file}`;
	compose(["cp", `falkordb:${remote}`, target]);
	chmodSync(target, 0o600);
	console.log(`Graph snapshot saved: ${target}`);
	return target;
}

export async function verifyRestore(path: string, recoveryGraph?: string) {
	if (recoveryGraph && !/^brainee_test_recovery_[a-f0-9]{32}$/.test(recoveryGraph)) {
		throw new Error("Invalid disposable recovery graph.");
	}
	const base = resolve(".local/backups/falkordb");
	const source = resolve(path);
	if (!source.startsWith(base + sep) || !source.endsWith(".rdb") || !existsSync(source)) {
		throw new Error("Select an existing .rdb file under .local/backups/falkordb.");
	}
	const name = `brainee-restore-check-${randomUUID()}`;
	let created = false;
	try {
		run("docker", ["create", "--name", name, "--network", "none",
			"-e", "BROWSER=0", "-e", "REDIS_ARGS=/etc/brainee-restore.conf",
			"--mount", `type=bind,source=${resolve("infra/falkordb/restore.conf")},target=/etc/brainee-restore.conf,readonly`, image], true);
		created = true;
		run("docker", ["cp", source, `${name}:/var/lib/falkordb/data/dump.rdb`], true);
		run("docker", ["start", name], true);
		const deadline = Date.now() + 30_000;
		while (true) {
			try {
				const result = run("docker", ["exec", name, "redis-cli", "--raw", "GRAPH.RO_QUERY", "brainee_dev",
					"MATCH (m:SchemaMigration {id:'0001-record-identities'}) RETURN m.checksum"], true);
				if (result.includes(migrationChecksum) && !result.includes("ERR")) break;
			} catch { /* Container may still be loading the snapshot. */ }
			if (Date.now() > deadline) throw new Error("Restored graph did not pass its schema-record check.");
			await new Promise(resolve => setTimeout(resolve, 250));
		}
		if (recoveryGraph) {
			const raw = run("docker", ["exec", name, "redis-cli", "--json", "GRAPH.RO_QUERY", recoveryGraph,
				"MATCH (t:Task {id:'recovery-fixture'}) RETURN t.id, t.estimateHours, t.dueDate"], true);
			const result = JSON.parse(raw);
			const rows = result[1];
			if (!Array.isArray(rows) || rows.length !== 1 || rows[0].length !== 3 ||
				rows[0][0] !== "recovery-fixture" || Number(rows[0][1]) !== 1.5 || rows[0][2] !== "2026-10-21") {
				throw new Error("Restored test record differs from its expected values.");
			}
		}
		console.log("Backup loaded in an isolated container; expected records recovered. Live graph untouched.");
	} finally {
		if (created && /^brainee-restore-check-[a-f0-9-]{36}$/.test(name)) {
			run("docker", ["rm", "-f", "-v", name], true);
		}
	}
}
