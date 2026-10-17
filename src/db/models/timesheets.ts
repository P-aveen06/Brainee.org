import { defineNode } from "../../../shared/graph/model";

export type TimesheetRow = {
	id: string;
	userId: string;
	date: string;
	hours: number;
	isOvertime: boolean;
	isWeekend: boolean;
	status: string;
	reEntryNote: string | null;
	reEntryFlaggedBy: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const timesheets = defineNode<TimesheetRow>("Timesheet");
