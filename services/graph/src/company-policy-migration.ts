import { createHash } from "node:crypto";
import { ConstraintType, EntityType, type Graph } from "falkordb";
import type { ConstraintRow } from "./schema.ts";

const backfill: Array<{
	query: string;
	params: Record<string, string | number>;
}> = [
	{
		query:
			"MATCH (d:CompanyPolicyDocument) WHERE d.status IS NULL SET d.status = $status",
		params: { status: "draft" },
	},
	{
		query:
			"MATCH (d:CompanyPolicyDocument) WHERE d.version IS NULL SET d.version = $version",
		params: { version: 1 },
	},
];
const constraints = ["status", "version"].map((property) => ({
	type: "MANDATORY" as const,
	label: "CompanyPolicyDocument",
	property,
}));

export const companyPolicyMigrationId = "0003-company-policy-review";
export const companyPolicyChecksum = createHash("sha256")
	.update(JSON.stringify({ backfill, constraints }))
	.digest("hex");

function hasConstraint(row: ConstraintRow, property: string) {
	return (
		row.type === "MANDATORY" &&
		row.label === "CompanyPolicyDocument" &&
		row.properties.length === 1 &&
		row.properties[0] === property
	);
}

export async function checkCompanyPolicyReady(graph: Graph) {
	const { data: rows = [] } = await graph.roQuery<ConstraintRow>(
		"CALL db.constraints()",
	);
	if (
		!constraints.every((constraint) =>
			rows.some(
				(row) =>
					hasConstraint(row, constraint.property) &&
					row.status === "OPERATIONAL",
			),
		)
	)
		throw new Error("Company policy constraints are not operational.");
	const { data: migrations = [] } = await graph.roQuery<{
		checksum: string;
	}>("MATCH (m:SchemaMigration {id:$id}) RETURN m.checksum AS checksum", {
		params: { id: companyPolicyMigrationId },
	});
	if (migrations[0]?.checksum !== companyPolicyChecksum)
		throw new Error("Company policy schema is missing or incompatible.");
}

export async function migrateCompanyPolicyDocuments(graph: Graph) {
	for (const step of backfill)
		await graph.query(step.query, { params: step.params });
	const { data: existing = [] } = await graph.roQuery<ConstraintRow>(
		"CALL db.constraints()",
	);
	if (existing.some((row) => row.status === "FAILED"))
		throw new Error("Resolve failed constraints before retrying migration.");
	for (const constraint of constraints) {
		if (existing.some((row) => hasConstraint(row, constraint.property)))
			continue;
		await graph.constraintCreate(
			ConstraintType[constraint.type],
			EntityType.NODE,
			constraint.label,
			constraint.property,
		);
	}
	const deadline = Date.now() + 10_000;
	while (true) {
		const { data: rows = [] } = await graph.roQuery<ConstraintRow>(
			"CALL db.constraints()",
		);
		if (rows.some((row) => row.status === "FAILED"))
			throw new Error("Company policy constraint creation failed.");
		if (
			constraints.every((constraint) =>
				rows.some(
					(row) =>
						hasConstraint(row, constraint.property) &&
						row.status === "OPERATIONAL",
				),
			)
		)
			break;
		if (Date.now() > deadline)
			throw new Error("Timed out waiting for company policy constraints.");
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	await graph.query(
		"MERGE (m:SchemaMigration {id:$id}) ON CREATE SET m.checksum=$checksum,m.appliedAt=$now",
		{
			params: {
				id: companyPolicyMigrationId,
				checksum: companyPolicyChecksum,
				now: Date.now(),
			},
		},
	);
	await checkCompanyPolicyReady(graph);
}
