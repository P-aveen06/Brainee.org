import { defineNode } from "../../../shared/graph/model";

export type ProjectMembershipRow = {
	id: string;
	projectId: string;
	userId: string;
	role: string;
	allocationPercent: number | null;
	billableRate: number | null;
	joinedAt: string | null;
	leftAt: string | null;
	leaveReason: string | null;
	replacedByUserId: string | null;
	addedById: string | null;
	isCurrent: boolean;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projectMembers =
	defineNode<ProjectMembershipRow>("ProjectMembership");
