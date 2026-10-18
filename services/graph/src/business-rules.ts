import { createHash } from "node:crypto";
import { models } from "../../../shared/graph/model.ts";
export const businessConstraints = models.flatMap((model) => [
	...model.unique
		.filter((keys) => !(keys.length === 1 && keys[0] === "id"))
		.map((properties) => ({
			label: model.label,
			properties,
			type: "UNIQUE" as const,
		})),
	...Object.entries(model.fields)
		.filter(
			([key, field]) =>
				field.required &&
				key !== "id" &&
				!(model.label === "Employee" && key === "authId"),
		)
		.map(([key]) => ({
			label: model.label,
			properties: [key],
			type: "MANDATORY" as const,
		})),
]);
businessConstraints.push(
	...["ProjectMembership", "AssetAssignment"].map((label) => ({
		label,
		properties: ["activeKey"],
		type: "UNIQUE" as const,
	})),
);
export const businessMigrationId = "0002-business-rules";
export const businessChecksum = createHash("sha256")
	.update(JSON.stringify(businessConstraints))
	.digest("hex");

// This exact prior 0002 checksum belongs to the schema that required
// ProposedAction.status. Its still-operational mandatory constraint is a safe
// superset of the current optional field, so existing graphs can migrate forward
// without rewriting their recorded migration history or dropping a constraint.
export const businessLegacyChecksums = [
	"469ccf455a1a7fa40b719fff1c6f1ef3f8c2d3e8c8b1cb6332f4e234c3130ee6",
] as const;
export const businessChecksums = [
	businessChecksum,
	...businessLegacyChecksums,
] as const;
