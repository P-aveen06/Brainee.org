import { defineNode } from "../../../shared/graph/model";

export type DailyUpdateItemRow = {
	id: string;
	updateId: string;
	taskId: string;
	note: string | null;
	progressNote: string | null;
	createdAt: Date | null;
};

export const projectDailyUpdateItems =
	defineNode<DailyUpdateItemRow>("DailyUpdateItem");
