import {
	businessChecksum,
	businessChecksums,
	businessConstraints,
	businessMigrationId,
} from "./business-rules.ts";

export {
	businessChecksum,
	businessChecksums,
	businessConstraints,
	businessLegacyChecksums,
	businessMigrationId,
} from "./business-rules.ts";

import { ConstraintType, EntityType, type Graph } from "falkordb";
import { ensureIndex } from "./migrations.ts";
import type { ConstraintRow } from "./schema.ts";

const same = (
	row: ConstraintRow,
	wanted: (typeof businessConstraints)[number],
) =>
	row.type === wanted.type &&
	row.label === wanted.label &&
	JSON.stringify(row.properties) === JSON.stringify(wanted.properties);
export async function checkBusinessReady(graph: Graph) {
	const { data = [] } = await graph.roQuery<ConstraintRow>(
		"CALL db.constraints()",
	);
	if (
		!businessConstraints.every((rule) =>
			data.some((row) => same(row, rule) && row.status === "OPERATIONAL"),
		)
	)
		throw new Error("Business constraints are not operational.");
	const { data: versions = [] } = await graph.roQuery<{ checksum: string }>(
		"MATCH (m:SchemaMigration {id:$id}) RETURN m.checksum AS checksum",
		{ params: { id: businessMigrationId } },
	);
	if (!businessChecksums.some((checksum) => checksum === versions[0]?.checksum))
		throw new Error("Business schema is missing or incompatible.");
}
export async function migrateBusiness(graph: Graph) {
	const { data: existing = [] } = await graph.roQuery<ConstraintRow>(
		"CALL db.constraints()",
	);
	for (const rule of businessConstraints) {
		if (existing.some((row) => same(row, rule))) continue;
		if (rule.type === "UNIQUE")
			for (const key of rule.properties)
				await ensureIndex(graph, rule.label, key);
		await graph.constraintCreate(
			ConstraintType[rule.type],
			EntityType.NODE,
			rule.label,
			...rule.properties,
		);
	}
	const deadline = Date.now() + 30000;
	while (true) {
		const { data = [] } = await graph.roQuery<ConstraintRow>(
			"CALL db.constraints()",
		);
		if (data.some((row) => row.status === "FAILED"))
			throw new Error("Business constraint failed.");
		if (
			businessConstraints.every((rule) =>
				data.some((row) => same(row, rule) && row.status === "OPERATIONAL"),
			)
		)
			break;
		if (Date.now() > deadline)
			throw new Error("Business constraint creation timed out.");
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	await graph.query(
		"MERGE (m:SchemaMigration {id:$id}) ON CREATE SET m.checksum=$checksum,m.appliedAt=$now",
		{
			params: {
				id: businessMigrationId,
				checksum: businessChecksum,
				now: Date.now(),
			},
		},
	);
	await checkBusinessReady(graph);
}
