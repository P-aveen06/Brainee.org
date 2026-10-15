import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import {
	leaveBalances,
	leaveRequests,
	publicHolidays,
	systemLeaveTypes,
} from "../db/schema";
import { parseDateInputToIso } from "./date-format";
import { ensureBalancesForCycle } from "./leave-balances.server";
import {
	ACTIVE_LEAVE_REQUEST_STATUSES,
	calculateBusinessLeaveDays,
	calculateWorkingDaysInAdvance,
	DAY_PORTIONS,
	getCompletedServiceYears,
	getIsoYear,
	getLeaveCycleBounds,
	getTodayIsoDate,
} from "./leave-policy";

const dateField = z.preprocess(
	(value) => parseDateInputToIso(value),
	z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use dd-MM-yyyy."),
);

export const leaveSchema = z
	.object({
		leave_type: z.string().min(1),
		start_date: dateField,
		end_date: dateField,
		start_day_portion: z.enum(DAY_PORTIONS),
		end_day_portion: z.enum(DAY_PORTIONS),
		reason: z.string().trim().max(500).optional().nullable(),
	})
	.refine((data) => data.end_date >= data.start_date, {
		message: "End date cannot be before the start date.",
		path: ["end_date"],
	});

export interface LeaveValidationResult {
	error?: string;
	success?: boolean;
	totalDays?: number;
	ruleViolationNote?: string | null;
	remainingBefore?: number;
	remainingAfter?: number;
}

export async function validateLeaveRequest(
	db: Database,
	user: { id: string; birthday: string | null; joinDate: string | null },
	rawInput: Record<string, unknown>,
	options: { provisionBalances?: boolean } = {},
): Promise<LeaveValidationResult> {
	const parsed = leaveSchema.safeParse(rawInput);

	if (!parsed.success) {
		return {
			error: parsed.error.issues[0]?.message || "Invalid leave request.",
		};
	}

	const leave = parsed.data;

	const leaveTypeSlug = leave.leave_type.toLowerCase();
	const isReasonCompulsory =
		leaveTypeSlug === "sick-leave" ||
		leaveTypeSlug === "sick_leave" ||
		leaveTypeSlug === "festival-leave" ||
		leaveTypeSlug === "festival_leave";

	if (
		isReasonCompulsory &&
		(!leave.reason || leave.reason.trim().length === 0)
	) {
		return { error: "Reason is required for Sick Leave and Festival Leave." };
	}

	const isSingleDay = leave.start_date === leave.end_date;

	if (isSingleDay && leave.end_day_portion !== "full_day") {
		return { error: "Single-day leave only uses one half-day selection." };
	}

	// Prevent leaves starting or ending on weekends
	const startDayOfWeek = new Date(leave.start_date).getUTCDay();
	const endDayOfWeek = new Date(leave.end_date).getUTCDay();

	if (startDayOfWeek === 0 || startDayOfWeek === 6) {
		return { error: "Leave start date cannot fall on a weekend." };
	}
	if (endDayOfWeek === 0 || endDayOfWeek === 6) {
		return { error: "Leave end date cannot fall on a weekend." };
	}

	if (!user.birthday) {
		return { error: "Complete onboarding before applying for leave." };
	}

	const startYr = getIsoYear(leave.start_date);
	const endYr = getIsoYear(leave.end_date);
	const years = Array.from(new Set([startYr, endYr]));

	const rawHolidays = await db
		.select({
			date: publicHolidays.date,
			name: publicHolidays.name,
			year: publicHolidays.year,
		})
		.from(publicHolidays)
		.where(
			or(
				eq(publicHolidays.year, 0),
				and(
					gte(publicHolidays.date, leave.start_date),
					lte(publicHolidays.date, leave.end_date),
				),
			),
		);

	// Holidays inside the range simply don't count against the balance
	// (decision: leave spanning a public holiday is allowed; the holiday
	// stays a holiday).
	const holidayDatesInRange: string[] = [];
	for (const h of rawHolidays) {
		if (h.year === 0) {
			const parts = h.date.split("-");
			const hMonth = parts[1];
			const hDay = parts[2];
			for (const yr of years) {
				const candidateDate = `${yr}-${hMonth}-${hDay}`;
				if (
					candidateDate >= leave.start_date &&
					candidateDate <= leave.end_date
				) {
					holidayDatesInRange.push(candidateDate);
				}
			}
		} else if (h.date >= leave.start_date && h.date <= leave.end_date) {
			holidayDatesInRange.push(h.date);
		}
	}

	const overlappingLeaves = await db
		.select({ id: leaveRequests.id })
		.from(leaveRequests)
		.where(
			and(
				eq(leaveRequests.userId, user.id),
				and(
					inArray(leaveRequests.status, ACTIVE_LEAVE_REQUEST_STATUSES),
					and(
						lte(leaveRequests.startDate, leave.end_date),
						gte(leaveRequests.endDate, leave.start_date),
					),
				),
			),
		);

	if (overlappingLeaves.length > 0) {
		return {
			error:
				"This leave overlaps an existing pending or approved leave request.",
		};
	}

	// The leave is charged to the cycle it starts in; provision that cycle's
	// balances if they don't exist yet (annual rollover happens lazily here).
	const cycle =
		options.provisionBalances === false
			? getLeaveCycleBounds(
					user.birthday,
					new Date(`${leave.start_date}T00:00:00Z`),
				)
			: await ensureBalancesForCycle(
					db,
					user,
					new Date(`${leave.start_date}T00:00:00Z`),
				);
	if (!cycle) {
		return { error: "Complete onboarding before applying for leave." };
	}

	let [balance] = await db
		.select({
			totalLimit: leaveBalances.totalLimit,
			used: leaveBalances.used,
		})
		.from(leaveBalances)
		.where(
			and(
				eq(leaveBalances.userId, user.id),
				eq(leaveBalances.leaveType, leave.leave_type),
				eq(leaveBalances.cycleStart, cycle.cycleStart),
			),
		)
		.limit(1);

	if (!balance && options.provisionBalances === false) {
		const [configuredType] = await db
			.select({
				defaultDays: systemLeaveTypes.defaultDays,
				accrualPerYear: systemLeaveTypes.accrualPerYear,
			})
			.from(systemLeaveTypes)
			.where(eq(systemLeaveTypes.slug, leave.leave_type))
			.limit(1);
		if (configuredType) {
			balance = {
				totalLimit:
					configuredType.defaultDays +
					configuredType.accrualPerYear *
						getCompletedServiceYears(user.joinDate, cycle.cycleStart),
				used: 0,
			};
		}
	}
	if (!balance)
		return { error: "Leave balance is not configured for this leave type." };

	const totalDays = calculateBusinessLeaveDays({
		startDate: leave.start_date,
		endDate: leave.end_date,
		startDayPortion: leave.start_day_portion,
		endDayPortion: isSingleDay ? "full_day" : leave.end_day_portion,
		holidayDates: holidayDatesInRange,
	});

	if (totalDays <= 0) {
		return { error: "This leave request does not contain any working days." };
	}

	if (balance.totalLimit - balance.used < totalDays) {
		return { error: "Insufficient leave balance for this request." };
	}

	// ─── Rule Warning Alert Check ───
	let ruleViolationNote: string | null = null;
	const [leaveTypeInfo] = await db
		.select({
			applyBeforeDays: systemLeaveTypes.applyBeforeDays,
			applyBeforeDaysExtended: systemLeaveTypes.applyBeforeDaysExtended,
			extendedLimitTrigger: systemLeaveTypes.extendedLimitTrigger,
			name: systemLeaveTypes.name,
		})
		.from(systemLeaveTypes)
		.where(eq(systemLeaveTypes.slug, leave.leave_type))
		.limit(1);

	if (leaveTypeInfo) {
		const applyBeforeDays = leaveTypeInfo.applyBeforeDays ?? 0;
		const applyBeforeDaysExt = leaveTypeInfo.applyBeforeDaysExtended ?? 0;
		const extTrigger = leaveTypeInfo.extendedLimitTrigger ?? 0;

		if (applyBeforeDays > 0 || (extTrigger > 0 && applyBeforeDaysExt > 0)) {
			const todayIso = getTodayIsoDate();

			const advanceWorkingDays = calculateWorkingDaysInAdvance(
				leave.start_date,
				todayIso,
			);

			const isExtended = extTrigger > 0 && totalDays >= extTrigger;
			const requiredAdvance = isExtended ? applyBeforeDaysExt : applyBeforeDays;

			if (advanceWorkingDays < requiredAdvance) {
				ruleViolationNote = `Applied ${advanceWorkingDays} working days in advance. Requires ${requiredAdvance} working days notice.`;
			}
		}
	}

	return {
		success: true,
		totalDays,
		ruleViolationNote,
		remainingBefore: balance.totalLimit - balance.used,
		remainingAfter: balance.totalLimit - balance.used - totalDays,
	};
}
