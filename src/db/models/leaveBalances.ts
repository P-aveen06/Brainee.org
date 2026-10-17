import { defineNode } from "../../../shared/graph/model";

export type LeaveBalanceRow = {
	id: string;
	userId: string;
	leaveType: string;
	totalLimit: number;
	used: number;
	cycleStart: string;
	cycleEnd: string;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const leaveBalances = defineNode<LeaveBalanceRow>("LeaveBalance");
