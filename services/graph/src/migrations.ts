import { ConstraintType, EntityType, type Graph } from "falkordb";
import {
	businessChecksums,
	businessMigrationId,
	checkBusinessReady,
	migrateBusiness,
} from "./business-schema.ts";
import {
	checkCompanyPolicyReady,
	companyPolicyChecksum,
	companyPolicyMigrationId,
	migrateCompanyPolicyDocuments,
} from "./company-policy-migration.ts";
import {
	type ConstraintRow,
	constraints,
	constraintsReady,
	migrationChecksum,
	migrationId,
	sameConstraint,
} from "./schema.ts";

const migrations = [
	{ id: migrationId, checksums: [migrationChecksum] },
	{ id: businessMigrationId, checksums: businessChecksums },
	{ id: companyPolicyMigrationId, checksums: [companyPolicyChecksum] },
];

function hasExpectedMigrations(
	versions: Array<{ id: string; checksum: string }>,
	allowMissing: boolean,
) {
	if (
		versions.some((version) => {
			const expected = migrations.find(
				(migration) => migration.id === version.id,
			);
			return (
				!expected ||
				!expected.checksums.some((checksum) => checksum === version.checksum)
			);
		})
	)
		return false;
	return (
		allowMissing ||
		(versions.length === migrations.length &&
			migrations.every(
				(expected) =>
					versions.filter((version) => version.id === expected.id).length === 1,
			))
	);
}

interface IndexRow {
	label: string;
	properties: string[];
	types: Record<string, string[]>;
	status: string;
}

export async function ensureIndex(
	graph: Graph,
	label: string,
	property: string,
) {
	const read = async () => {
		const { data = [] } = await graph.roQuery<IndexRow>("CALL db.indexes()", {
			TIMEOUT: 3000,
		});
		return data.find(
			(row) => row.label === label && row.types[property]?.includes("RANGE"),
		);
	};
	// A fresh graph has no key yet, so read-only metadata cannot precede its first index.
	try {
		await graph.query(`CREATE INDEX FOR (n:${label}) ON (n.${property})`);
	} catch (error) {
		const duplicate = `Attribute '${property}' is already indexed`;
		if (!(error instanceof Error) || !error.message.includes(duplicate))
			throw error;
		// Verify the existing index's type/status below; do not treat all query errors as success.
	}
	const deadline = Date.now() + 10_000;
	while (true) {
		const row = await read();
		if (row?.status === "OPERATIONAL") return;
		if (row?.status === "FAILED" || Date.now() > deadline) {
			throw new Error("Graph range index is not operational.");
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}

export async function checkReady(graph: Graph) {
	const { data: versions = [] } = await graph.roQuery<{
		id: string;
		checksum: string;
	}>("MATCH (m:SchemaMigration) RETURN m.id AS id, m.checksum AS checksum", {
		TIMEOUT: 3000,
	});
	if (!hasExpectedMigrations(versions, false)) {
		throw new Error(
			"Graph schema is missing or incompatible. Run graph:migrate.",
		);
	}
	const { data = [] } = await graph.roQuery<ConstraintRow>(
		"CALL db.constraints()",
		{ TIMEOUT: 3000 },
	);
	await checkBusinessReady(graph);
	await checkCompanyPolicyReady(graph);
	if (!constraintsReady(data))
		throw new Error("Graph constraints are not operational.");
}

export async function migrate(graph: Graph) {
	// Index creation initializes an empty graph; it creates no employee/sample nodes.
	await ensureIndex(graph, "SchemaMigration", "id");
	const { data: versions = [] } = await graph.roQuery<{
		id: string;
		checksum: string;
	}>("MATCH (m:SchemaMigration) RETURN m.id AS id, m.checksum AS checksum");
	if (!hasExpectedMigrations(versions, true)) {
		throw new Error("Refusing to change an incompatible graph schema.");
	}
	const { data: existing = [] } = await graph.roQuery<ConstraintRow>(
		"CALL db.constraints()",
	);
	if (existing.some((row) => row.status === "FAILED")) {
		throw new Error("Resolve failed constraints before retrying migration.");
	}
	for (const constraint of constraints) {
		if (existing.some((row) => sameConstraint(row, constraint))) continue;
		if (constraint.type === "UNIQUE") {
			await ensureIndex(graph, constraint.label, constraint.property);
		}
		await graph.constraintCreate(
			ConstraintType[constraint.type],
			EntityType.NODE,
			constraint.label,
			constraint.property,
		);
	}
	const deadline = Date.now() + 30_000;
	while (true) {
		const { data: rows = [] } = await graph.roQuery<ConstraintRow>(
			"CALL db.constraints()",
		);
		if (rows.some((row) => row.status === "FAILED"))
			throw new Error("Constraint creation failed.");
		if (constraintsReady(rows)) break;
		if (Date.now() > deadline)
			throw new Error("Timed out waiting for graph constraints.");
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	await graph.query(
		"MERGE (m:SchemaMigration {id: $id}) ON CREATE SET m.checksum = $checksum, m.appliedAt = $now",
		{
			params: { id: migrationId, checksum: migrationChecksum, now: Date.now() },
		},
	);
	await migrateCompanyPolicyDocuments(graph);
	await migrateBusiness(graph);
	await checkReady(graph);
}
