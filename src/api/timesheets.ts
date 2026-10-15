import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../db";
import { leaveRequests, publicHolidays, timesheets } from "../db/schema";
import { logAuditEvent } from "../lib/audit.server";
import {
	getLeaveCoverageForDate,
	getTodayIsoDate,
	OPERATIONALLY_ACTIVE_LEAVE_STATUSES,
} from "../lib/leave-policy";
import { authMiddleware } from "../lib/server-fn";

const timesheetSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
	hours: z.coerce.number().positive("Hours must be greater than 0").max(24),
});

export const logTimesheet = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => {
		return z
			.object({
				date: z.string(),
				hours: z.coerce.number(),
			})
			.parse(data);
	})
	.handler(async ({ data: input, context }) => {
		const user = context.user;
		const parsed = timesheetSchema.safeParse(input);
		if (!parsed.success) {
			return { error: parsed.error.issues[0]?.message || "Invalid data." };
		}

		if (parsed.data.date > getTodayIsoDate()) {
			return {
				error: "Timesheets can only be logged for today or past dates.",
			};
		}

		const db = createDb(env.DATABASE);
		const dateParts = parsed.data.date.split("-");
		const targetMonth = dateParts[1];
		const targetDay = dateParts[2];

		const holidaysRes = await db.select().from(publicHolidays);
		const holiday = holidaysRes.find((h) => {
			if (h.year === 0) {
				const parts = h.date.split("-");
				const hMonth = parts[1];
				const hDay = parts[2];
				return hMonth === targetMonth && hDay === targetDay;
			}
			return h.date === parsed.data.date;
		});

		if (holiday) {
			return {
				error: `Timesheets are not required on the public holiday ${holiday.name}.`,
			};
		}

		const [activeLeave] = await db
			.select()
			.from(leaveRequests)
			.where(
				and(
					eq(leaveRequests.userId, user.id),
					inArray(leaveRequests.status, OPERATIONALLY_ACTIVE_LEAVE_STATUSES),
					lte(leaveRequests.startDate, parsed.data.date),
					gte(leaveRequests.endDate, parsed.data.date),
				),
			)
			.limit(1);

		const leaveCoverage = activeLeave
			? getLeaveCoverageForDate({
					date: parsed.data.date,
					endDate: activeLeave.endDate,
					startDate: activeLeave.startDate,
					isHalfDayEnd: activeLeave.isHalfDayEnd,
					isHalfDayStart: activeLeave.isHalfDayStart,
					halfDayEndPeriod: activeLeave.halfDayEndPeriod,
					halfDayStartPeriod: activeLeave.halfDayStartPeriod,
				})
			: null;

		if (leaveCoverage === "full_day") {
			return {
				error: "Timesheets cannot be logged on a full-day leave.",
			};
		}

		if (leaveCoverage === "first_half" || leaveCoverage === "second_half") {
			if (parsed.data.hours !== 4) {
				return { error: "You must log exactly 4 hours on a half-day leave." };
			}
		}

		const dateObject = new Date(`${parsed.data.date}T00:00:00`);
		const isWeekend = dateObject.getDay() === 0 || dateObject.getDay() === 6;
		const isOvertime = parsed.data.hours > user.standardHours;

		// Snapshot any prior entry so overwriting a logged/flagged row leaves an
		// auditable trail instead of silently replacing history.
		const [existing] = await db
			.select({
				hours: timesheets.hours,
				status: timesheets.status,
				reEntryNote: timesheets.reEntryNote,
			})
			.from(timesheets)
			.where(
				and(
					eq(timesheets.userId, user.id),
					eq(timesheets.date, parsed.data.date),
				),
			)
			.limit(1);

		await db
			.insert(timesheets)
			.values({
				id: crypto.randomUUID(),
				userId: user.id,
				date: parsed.data.date,
				hours: parsed.data.hours,
				isWeekend,
				isOvertime,
				status: "logged",
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [timesheets.userId, timesheets.date],
				set: {
					hours: parsed.data.hours,
					isWeekend,
					isOvertime,
					status: "logged",
					reEntryNote: null,
					reEntryFlaggedBy: null,
					updatedAt: new Date(),
				},
			});

		await logAuditEvent(db, {
			actorId: user.id,
			action: existing ? "update_timesheet" : "create_timesheet",
			entityType: "timesheets",
			entityId: `${user.id}_${parsed.data.date}`,
			oldData: existing
				? {
						hours: existing.hours,
						status: existing.status,
						re_entry_note: existing.reEntryNote,
					}
				: null,
			newData: { hours: parsed.data.hours, status: "logged" },
		});

		return { success: true };
	});
