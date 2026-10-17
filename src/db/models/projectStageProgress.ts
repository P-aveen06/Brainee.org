import { defineNode } from "../../../shared/graph/model";

export type StageProgressRow = {
	id: string;
	projectId: string;
	stageKey: string;
	status: string;
	startedAt: Date | null;
	completedAt: Date | null;
	completedById: string | null;
	notes: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projectStageProgress =
	defineNode<StageProgressRow>("StageProgress");
