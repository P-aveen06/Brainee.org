import { defineNode } from "../../../shared/graph/model";

export type LeaveRequestRow = {
	id: string;
	userId: string;
	leaveType: string;
	startDate: string;
	endDate: string;
	isHalfDayStart: boolean;
	halfDayStartPeriod: string | null;
	isHalfDayEnd: boolean;
	halfDayEndPeriod: string | null;
	totalDays: number;
	status: string;
	approvedBy: string | null;
	rejectedBy: string | null;
	rejectionReason: string | null;
	revokedBy: string | null;
	revokeReason: string | null;
	reEntryNote: string | null;
	reason: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const leaveRequests = defineNode<LeaveRequestRow>("LeaveRequest");
