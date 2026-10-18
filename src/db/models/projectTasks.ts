import { defineNode } from "../../../shared/graph/model";

export type TaskRow = {
	id: string;
	projectId: string;
	stageKey: string | null;
	parentTaskId: string | null;
	taskNumber: number;
	title: string;
	description: string | null;
	status: string;
	priority: string;
	assigneeId: string | null;
	createdById: string | null;
	startDate: string | null;
	dueDate: string | null;
	completedAt: Date | null;
	estimateHours: number | null;
	actualHours: number | null;
	sourceTaskId?: string | null;
	sourceProjectId?: string | null;
	adaptationAssumptions?: string | null;
	blockedReason: string | null;
	sequence: number;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projectTasks = defineNode<TaskRow>("Task");
