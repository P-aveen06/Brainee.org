import { defineNode } from "../../../shared/graph/model";

export type LeaveTypeRow = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	defaultDays: number;
	accrualPerYear: number;
	applyBeforeDays: number;
	applyBeforeDaysExtended: number;
	extendedLimitTrigger: number;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const systemLeaveTypes = defineNode<LeaveTypeRow>("LeaveType");
