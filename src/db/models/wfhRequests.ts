import { defineNode } from "../../../shared/graph/model";

export type WfhRequestRow = {
	id: string;
	userId: string;
	date: string;
	isHalfDay: boolean;
	halfDayPeriod: string | null;
	status: string;
	approvedBy: string | null;
	rejectedBy: string | null;
	rejectionReason: string | null;
	revokedBy: string | null;
	revokeReason: string | null;
	reEntryNote: string | null;
	reEntryFlaggedBy: string | null;
	reason: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const wfhRequests = defineNode<WfhRequestRow>("WfhRequest");
