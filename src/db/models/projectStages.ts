import { defineNode } from "../../../shared/graph/model";

export type StageDefinitionRow = {
	id: string;
	key: string;
	name: string;
	description: string | null;
	sequence: number;
	appliesToType: string | null;
	isActive: boolean;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projectStages = defineNode<StageDefinitionRow>("StageDefinition");
