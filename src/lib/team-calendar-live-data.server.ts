import { endOfMonth, format, startOfMonth } from "date-fns";
import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import {
	ACTIVE_LEAVE_REQUEST_STATUSES,
	getLeaveCoverageForDate,
} from "./leave-policy";

// WFH rows that represent a real calendar presence (mirrors the leave statuses).
const ACTIVE_WFH_STATUSES = [
	"pending",
	"approved",
	"pending_cancellation",
] as const;

import type { Database } from "../db";
import {
	leaveRequests,
	publicHolidays,
	timesheets,
	users,
	wfhRequests,
} from "../db/schema";

export type TeamCalendarEvent = {
	id: string;
	type: "leave" | "wfh" | "holiday" | "timesheet";
	date: string;
	status: string;
	details?: string;
	hours?: number;
	portion?: "full_day" | "first_half" | "second_half";
};

export type TeamCalendarEmployee = {
	id: string;
	name: string;
	role: string;
	avatarUrl?: string;
	events: TeamCalendarEvent[];
};

export async function getTeamCalendarLiveData(
	db: Database,
	currentDate = new Date(),
) {
	const startDateStr = format(
		startOfMonth(
			new Date(currentDate.getFullYear(), currentDate.getMonth() - 1),
		),
		"yyyy-MM-dd",
	);
	const endDateStr = format(
		endOfMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)),
		"yyyy-MM-dd",
	);

	const usersList = await db
		.select({
			id: users.id,
			name: users.name,
			role: users.role,
			avatarUrl: users.avatarUrl,
		})
		.from(users)
		.where(eq(users.isActive, true))
		.orderBy(users.name);

	const [timesheetsList, leavesList, wfhsList, holidaysList] =
		await Promise.all([
			db
				.select()
				.from(timesheets)
				.where(
					and(
						gte(timesheets.date, startDateStr),
						lte(timesheets.date, endDateStr),
					),
				),
			db
				.select()
				.from(leaveRequests)
				.where(
					and(
						gte(leaveRequests.endDate, startDateStr),
						lte(leaveRequests.startDate, endDateStr),
						inArray(leaveRequests.status, ACTIVE_LEAVE_REQUEST_STATUSES),
					),
				),
			db
				.select()
				.from(wfhRequests)
				.where(
					and(
						gte(wfhRequests.date, startDateStr),
						lte(wfhRequests.date, endDateStr),
						inArray(wfhRequests.status, ACTIVE_WFH_STATUSES),
					),
				),
			db
				.select()
				.from(publicHolidays)
				.where(
					or(
						eq(publicHolidays.year, 0),
						and(
							gte(publicHolidays.date, startDateStr),
							lte(publicHolidays.date, endDateStr),
						),
					),
				),
		]);

	const startYr = new Date(startDateStr).getFullYear();
	const endYr = new Date(endDateStr).getFullYear();
	const years = Array.from(new Set([startYr, endYr]));

	const sysHolidays: {
		id: string;
		type: "holiday";
		date: string;
		status: "approved";
		details: string;
	}[] = [];

	for (const holiday of holidaysList) {
		if (holiday.year === 0) {
			const parts = holiday.date.split("-");
			const month = parts[1];
			const day = parts[2];
			for (const yr of years) {
				const candidateDate = `${yr}-${month}-${day}`;
				if (candidateDate >= startDateStr && candidateDate <= endDateStr) {
					sysHolidays.push({
						id: `${holiday.id}-${yr}`,
						type: "holiday" as const,
						date: candidateDate,
						status: "approved",
						details: holiday.name,
					});
				}
			}
		} else {
			if (holiday.date >= startDateStr && holiday.date <= endDateStr) {
				sysHolidays.push({
					id: holiday.id,
					type: "holiday" as const,
					date: holiday.date,
					status: "approved",
					details: holiday.name,
				});
			}
		}
	}

	return usersList.map((user): TeamCalendarEmployee => {
		const userTimesheets = (timesheetsList || [])
			.filter((timesheet) => timesheet.userId === user.id)
			.map((timesheet) => ({
				id: timesheet.id,
				type: "timesheet" as const,
				date: timesheet.date,
				status: timesheet.status,
				details: `${timesheet.hours}h logged`,
				hours: Number(timesheet.hours),
			}));

		const userLeaves = (leavesList || [])
			.filter((leave) => leave.userId === user.id)
			.flatMap((leave) => {
				const events = [];
				const current = new Date(leave.startDate);
				const end = new Date(leave.endDate);

				while (current <= end) {
					const dateStr = format(current, "yyyy-MM-dd");
					const portion = getLeaveCoverageForDate({
						date: dateStr,
						startDate: leave.startDate,
						endDate: leave.endDate,
						isHalfDayStart: leave.isHalfDayStart ?? false,
						isHalfDayEnd: leave.isHalfDayEnd ?? false,
						halfDayStartPeriod: leave.halfDayStartPeriod,
						halfDayEndPeriod: leave.halfDayEndPeriod,
					});

					if (portion) {
						events.push({
							id: `${leave.id}-${current.getTime()}`,
							type: "leave" as const,
							date: dateStr,
							status: leave.status,
							details: leave.leaveType,
							portion: portion as "full_day" | "first_half" | "second_half",
						});
					}
					current.setDate(current.getDate() + 1);
				}

				return events;
			});

		const userWfhs = (wfhsList || [])
			.filter((wfh) => wfh.userId === user.id)
			.map((wfh) => ({
				id: wfh.id,
				type: "wfh" as const,
				date: wfh.date,
				status: wfh.status,
				portion: (wfh.isHalfDay
					? (wfh.halfDayPeriod as "first_half" | "second_half")
					: "full_day") as "full_day" | "first_half" | "second_half",
			}));

		return {
			id: user.id,
			name: user.name || "Unknown",
			role: user.role || "user",
			avatarUrl: user.avatarUrl ?? undefined,
			events: [...userTimesheets, ...userLeaves, ...userWfhs, ...sysHolidays],
		};
	});
}
