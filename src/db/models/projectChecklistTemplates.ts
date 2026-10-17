import { defineNode } from "../../../shared/graph/model";

export type ChecklistTemplateRow = {
	id: string;
	stageKey: string;
	title: string;
	description: string | null;
	isRequired: boolean;
	sequence: number;
	isActive: boolean;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projectChecklistTemplates =
	defineNode<ChecklistTemplateRow>("ChecklistTemplate");
