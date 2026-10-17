import { and, eq, gte, inArray, lte } from "@/db/graph-query";
import { createDb } from "../db";
import {
	leaveRequests,
	publicHolidays,
	users,
	wfhRequests,
} from "../db/schema";
import {
	addIsoDays,
	formatLeaveType,
	OPERATIONALLY_ACTIVE_LEAVE_STATUSES,
} from "./leave-policy";

export type CalendarEventKind = "leave" | "wfh" | "birthday" | "holiday";

export interface CalendarEvent {
	date: string;
	kind: CalendarEventKind;
	label: string;
	avatarUrl?: string | null;
}

function monthBounds(month: string) {
	const [y, m] = month.split("-").map(Number);
	const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return {
		year: y,
		mm: String(m).padStart(2, "0"),
		start: `${month}-01`,
		end: `${month}-${String(last).padStart(2, "0")}`,
	};
}

/** Every ISO date in [from, to], clipped to the visible month. */
export function eachDay(from: string, to: string, min: string, max: string) {
	const days: string[] = [];
	let d = from < min ? min : from;
	const stop = to > max ? max : to;
	while (d <= stop) {
		days.push(d);
		d = addIsoDays(d, 1);
	}
	return days;
}

/** Team leave/WFH, birthdays and public holidays for one month. */
export async function getCalendarEvents(
	month: string,
): Promise<CalendarEvent[]> {
	const db = createDb();
	const { start, end, mm } = monthBounds(month);
	const events: CalendarEvent[] = [];

	const [leaves, wfhs, holidays, people] = await Promise.all([
		db
			.select({
				startDate: leaveRequests.startDate,
				endDate: leaveRequests.endDate,
				leaveType: leaveRequests.leaveType,
				name: users.name,
				avatarUrl: users.avatarUrl,
			})
			.from(leaveRequests)
			.innerJoin(users, eq(leaveRequests.userId, users.id))
			.where(
				and(
					inArray(leaveRequests.status, OPERATIONALLY_ACTIVE_LEAVE_STATUSES),
					lte(leaveRequests.startDate, end),
					gte(leaveRequests.endDate, start),
				),
			),
		db
			.select({
				date: wfhRequests.date,
				name: users.name,
				avatarUrl: users.avatarUrl,
			})
			.from(wfhRequests)
			.innerJoin(users, eq(wfhRequests.userId, users.id))
			.where(
				and(
					eq(wfhRequests.status, "approved"),
					gte(wfhRequests.date, start),
					lte(wfhRequests.date, end),
				),
			),
		db
			.select({ date: publicHolidays.date, name: publicHolidays.name })
			.from(publicHolidays)
			.where(
				and(gte(publicHolidays.date, start), lte(publicHolidays.date, end)),
			),
		db
			.select({
				name: users.name,
				avatarUrl: users.avatarUrl,
				birthday: users.birthday,
			})
			.from(users)
			.where(eq(users.isActive, true)),
	]);

	for (const l of leaves) {
		for (const date of eachDay(l.startDate, l.endDate, start, end)) {
			events.push({
				date,
				kind: "leave",
				label: `${l.name} · ${formatLeaveType(l.leaveType)}`,
				avatarUrl: l.avatarUrl,
			});
		}
	}
	for (const w of wfhs) {
		events.push({
			date: w.date,
			kind: "wfh",
			label: `${w.name} · WFH`,
			avatarUrl: w.avatarUrl,
		});
	}
	for (const h of holidays) {
		events.push({ date: h.date, kind: "holiday", label: h.name });
	}
	for (const p of people) {
		if (p.birthday?.slice(5, 7) !== mm) continue;
		events.push({
			date: `${month}-${p.birthday.slice(8, 10)}`,
			kind: "birthday",
			label: `${p.name}'s birthday`,
			avatarUrl: p.avatarUrl,
		});
	}

	return events;
}
