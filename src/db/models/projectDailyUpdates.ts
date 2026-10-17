import { defineNode } from "../../../shared/graph/model";

export type DailyUpdateRow = {
	id: string;
	projectId: string;
	userId: string;
	date: string;
	summary: string;
	blockers: string | null;
	hoursSpent: number | null;
	status: string;
	submittedAt: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projectDailyUpdates = defineNode<DailyUpdateRow>("DailyUpdate");
