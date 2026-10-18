import { defineNode } from "../../../shared/graph/model";

export type ChecklistItemRow = {
	id: string;
	projectId: string;
	stageKey: string;
	templateId: string | null;
	title: string;
	description: string | null;
	isRequired: boolean;
	status: string;
	assignedToId: string | null;
	createdById: string | null;
	dueDate: string | null;
	completedById: string | null;
	completedAt: Date | null;
	notes: string | null;
	sequence: number;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projectChecklistItems =
	defineNode<ChecklistItemRow>("ChecklistItem");
