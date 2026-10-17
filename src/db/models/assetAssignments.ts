import { defineNode } from "../../../shared/graph/model";

export type AssetAssignmentRow = {
	id: string;
	assetId: string;
	userId: string;
	clientDeploymentId: string | null;
	assignedDate: string;
	returnedDate: string | null;
	conditionOut: string;
	conditionIn: string | null;
	returnDestination: string | null;
	returnNotes: string | null;
	assignedByUserId: string | null;
	receivedByUserId: string | null;
	acknowledgedAt: Date | null;
	issueReportedAt: Date | null;
	issueDescription: string | null;
	issueStatus: string | null;
	isCurrent: boolean;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const assetAssignments =
	defineNode<AssetAssignmentRow>("AssetAssignment");
