import { defineNode } from "../../../shared/graph/model";

export type HolidayRow = {
	id: string;
	date: string;
	name: string;
	description: string | null;
	year: number;
	createdAt: Date | null;
};

export const publicHolidays = defineNode<HolidayRow>("Holiday");
