import {
	byTable,
	type ModelDefinition,
	type ReferenceDefinition,
} from "./model.ts";

export interface GraphReference extends ReferenceDefinition {
	edge: string;
	incoming?: boolean;
}
const specific: Record<string, Record<string, [string, boolean?]>> = {
	Employee: { peerLeadId: ["REPORTS_TO"] },
	Task: {
		projectId: ["HAS_TASK", true],
		assigneeId: ["ASSIGNED_TO"],
		parentTaskId: ["PARENT_TASK"],
	},
	ProjectMembership: {
		userId: ["HAS_MEMBERSHIP", true],
		projectId: ["IN_PROJECT"],
	},
	Project: { ownerId: ["OWNED_BY"], clientCompanyId: ["FOR_CLIENT"] },
	LeaveRequest: { userId: ["REQUESTED", true] },
	WfhRequest: { userId: ["REQUESTED", true] },
	LeaveBalance: { userId: ["FOR_EMPLOYEE"] },
	Timesheet: { userId: ["FOR_EMPLOYEE"] },
	AssetAssignment: {
		assetId: ["FOR_ASSET"],
		userId: ["ASSIGNED_TO"],
		clientDeploymentId: ["FOR_DEPLOYMENT"],
	},
	Asset: { ownerCompanyId: ["OWNED_BY"], replacedByAssetId: ["REPLACED_BY"] },
	CompanyPolicyDocument: { uploadedById: ["UPLOADED_BY"] },
};
export function references(model: ModelDefinition): GraphReference[] {
	const result = model.references.map((ref) => {
		const field = ref.fields[0];
		const [edge, incoming] = specific[model.label]?.[field] ?? [
			field === "projectId"
				? "IN_PROJECT"
				: field === "userId"
					? "FOR_EMPLOYEE"
					: field
							.replace(/Id$/, " ")
							.trim()
							.replace(/[A-Z]/g, (c) => `_${c}`)
							.toUpperCase(),
		];
		return { ...ref, edge, incoming };
	});
	if (model.label === "LeaveRequest" || model.label === "LeaveBalance") {
		result.push({
			fields: ["leaveType"],
			target: "system_leave_types",
			targetFields: ["slug"],
			edge: "OF_LEAVE_TYPE",
			incoming: false,
		});
	}
	return result;
}
export function referenceTarget(ref: GraphReference) {
	const target = byTable.get(ref.target);
	if (!target) throw new Error("Unknown graph reference target.");
	return target;
}
export function relationshipPattern(
	node: string,
	variable: string,
	ref: GraphReference,
	edgeVariable = "",
) {
	return ref.incoming
		? `(${variable})-[${edgeVariable}:${ref.edge}]->(${node})`
		: `(${node})-[${edgeVariable}:${ref.edge}]->(${variable})`;
}
