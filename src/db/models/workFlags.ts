import { defineNode } from "../../../shared/graph/model";

export type WorkFlagRow = {
	id: string;
	projectId: string;
	entityType: string;
	entityId: string;
	flagCode: string;
	severity: string;
	message: string;
	evidence: string | null;
	source: string;
	status: string;
	raisedForUserId: string | null;
	resolvedById: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const workFlags = defineNode<WorkFlagRow>("WorkFlag");
