import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../db";
import {
	leaveRequests,
	publicHolidays,
	systemLeaveTypes,
	wfhPolicy,
	wfhRequests,
} from "../db/schema";
import { getCurrentAppUser } from "../lib/current-user.server";
import { formatDateDisplay } from "../lib/date-format";
import {
	ACTIVE_LEAVE_REQUEST_STATUSES,
	DAY_PORTIONS,
	getLeaveCancellationTargetStatus,
	getLeaveCoverageForDate,
} from "../lib/leave-policy";
import { notifyApprovers } from "../lib/notifications.server";
import { authMiddleware } from "../lib/server-fn";
import {
	calculateWfhQuota,
	DEFAULT_WFH_ALLOWANCE,
	getExistingWfhDateError,
	getWfhCycleBounds,
	getWfhRequestDays,
	isSqliteWfhDateUniqueConstraintError,
	isValidWfhDate,
	WFH_POLICY_ID,
} from "../lib/wfh-policy";
import { applyForLeaveCore, applyForLeaveSchema } from "./leaves-apply.server";
import { cancelLeaveRequestCore } from "./leaves-cancel.server";

// Server action helper to parse reason
function normalizeReason(value: string | undefined | null) {
	return value && value.trim().length > 0 ? value.trim() : null;
}

export const getInitialLeaveRequestData = createServerFn({
	method: "GET",
})
	.middleware([authMiddleware])
	.handler(async () => {
		const db = createDb(env.DATABASE);
		const leaveTypes = await db.select().from(systemLeaveTypes);
		const holidays = await db.select().from(publicHolidays);
		const mappedLeaveTypes = leaveTypes.map((t) => ({
			id: t.id,
			name: t.name,
			slug: t.slug,
			apply_before_days: t.applyBeforeDays,
			apply_before_days_extended: t.applyBeforeDaysExtended,
			extended_limit_trigger: t.extendedLimitTrigger,
		}));
		return { leaveTypes: mappedLeaveTypes, holidays };
	});

export const applyForLeave = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => applyForLeaveSchema.parse(data))
	.handler(async ({ data: input }) => {
		const user = await getCurrentAppUser();
		if (!user) {
			return { error: "Unauthorized" };
		}

		const db = createDb(env.DATABASE);
		return applyForLeaveCore(db, user, input);
	});

export const cancelLeaveRequest = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => {
		return z.string().parse(data);
	})
	.handler(async ({ data: id }) => {
		const user = await getCurrentAppUser();
		if (!user) {
			return { error: "Unauthorized" };
		}

		return cancelLeaveRequestCore(createDb(env.DATABASE), user, id);
	});

export const applyForWfh = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => {
		return z
			.object({
				date: z.string().refine(isValidWfhDate, {
					message: "Date must be a valid calendar date in YYYY-MM-DD format.",
				}),
				day_portion: z.enum(DAY_PORTIONS),
				reason: z.string().optional().nullable(),
			})
			.parse(data);
	})
	.handler(async ({ data: input }) => {
		const user = await getCurrentAppUser();
		if (!user) {
			return { error: "Unauthorized" };
		}

		// Prevent WFH on weekends
		const dayOfWeek = new Date(input.date).getUTCDay();
		if (dayOfWeek === 0 || dayOfWeek === 6) {
			return { error: "WFH cannot be applied on weekends." };
		}

		const db = createDb(env.DATABASE);
		if (!user.birthday) {
			return {
				error: "Set your birthday in your profile before applying for WFH.",
			};
		}

		const dateParts = input.date.split("-");
		const targetMonth = dateParts[1];
		const targetDay = dateParts[2];

		// Check public holidays
		const holidays = await db.select().from(publicHolidays);
		const holiday = holidays.find((h) => {
			if (h.year === 0) {
				const parts = h.date.split("-");
				const hMonth = parts[1];
				const hDay = parts[2];
				return hMonth === targetMonth && hDay === targetDay;
			}
			return h.date === input.date;
		});

		if (holiday) {
			return {
				error: `WFH cannot be applied on the public holiday ${holiday.name}.`,
			};
		}

		// The schema permits only one WFH row per user/date, regardless of status.
		// Treat historical rows as duplicates instead of letting the unique index
		// surface as an unhandled database error.
		const existingWfh = await db
			.select({ status: wfhRequests.status })
			.from(wfhRequests)
			.where(
				and(eq(wfhRequests.userId, user.id), eq(wfhRequests.date, input.date)),
			)
			.limit(1);

		const existingWfhError = getExistingWfhDateError(existingWfh[0]?.status);
		if (existingWfhError) {
			return { error: existingWfhError };
		}

		// Check overlapping leaves
		const leaveRows = await db
			.select()
			.from(leaveRequests)
			.where(
				and(
					eq(leaveRequests.userId, user.id),
					inArray(leaveRequests.status, ACTIVE_LEAVE_REQUEST_STATUSES),
				),
			);

		const matchingLeave = leaveRows.find(
			(l) => input.date >= l.startDate && input.date <= l.endDate,
		);

		if (matchingLeave) {
			const leaveCoverage = getLeaveCoverageForDate({
				date: input.date,
				endDate: matchingLeave.endDate,
				startDate: matchingLeave.startDate,
				isHalfDayEnd: matchingLeave.isHalfDayEnd,
				isHalfDayStart: matchingLeave.isHalfDayStart,
				halfDayEndPeriod: matchingLeave.halfDayEndPeriod,
				halfDayStartPeriod: matchingLeave.halfDayStartPeriod,
			});

			if (
				leaveCoverage === "full_day" ||
				leaveCoverage === input.day_portion ||
				input.day_portion === "full_day"
			) {
				return {
					error: "WFH conflicts with an existing leave request for this date.",
				};
			}
		}

		const cycle = getWfhCycleBounds(user.birthday, input.date);
		const [[policy], reservedRequests] = await Promise.all([
			db
				.select({ annualAllowance: wfhPolicy.annualAllowance })
				.from(wfhPolicy)
				.where(eq(wfhPolicy.id, WFH_POLICY_ID))
				.limit(1),
			db
				.select({ isHalfDay: wfhRequests.isHalfDay })
				.from(wfhRequests)
				.where(
					and(
						eq(wfhRequests.userId, user.id),
						gte(wfhRequests.date, cycle.cycleStart),
						lte(wfhRequests.date, cycle.cycleEnd),
						inArray(wfhRequests.status, ["pending", "approved"]),
					),
				),
		]);
		const allowance = Number(policy?.annualAllowance ?? DEFAULT_WFH_ALLOWANCE);
		const reserved = reservedRequests.reduce(
			(total, request) => total + (request.isHalfDay ? 0.5 : 1),
			0,
		);
		const requestedDays = getWfhRequestDays(input.day_portion);
		const quota = calculateWfhQuota({
			allowance,
			reserved,
			requested: requestedDays,
		});
		if (!quota.canRequest) {
			return {
				error: `This request exceeds your WFH allowance. You have ${quota.remaining} day${quota.remaining === 1 ? "" : "s"} remaining in this cycle.`,
			};
		}

		const requestId = crypto.randomUUID();
		let insertResult: Awaited<
			ReturnType<ReturnType<typeof env.DATABASE.prepare>["run"]>
		>;
		try {
			insertResult = await env.DATABASE.prepare(
				`INSERT INTO wfh_requests (id, user_id, date, is_half_day, half_day_period, status, reason)
			 SELECT ?, ?, ?, ?, ?, 'pending', ?
			 WHERE NOT EXISTS (
				 SELECT 1 FROM wfh_requests
				 WHERE user_id = ? AND date = ?
			 )
			 AND ? + COALESCE((
				 SELECT SUM(CASE WHEN is_half_day = 1 THEN 0.5 ELSE 1 END)
				 FROM wfh_requests
				 WHERE user_id = ? AND date >= ? AND date <= ? AND status IN ('pending', 'approved')
			 ), 0) <= COALESCE((SELECT annual_allowance FROM wfh_policy WHERE id = 1), ?)`,
			)
				.bind(
					requestId,
					user.id,
					input.date,
					input.day_portion !== "full_day" ? 1 : 0,
					input.day_portion === "full_day" ? null : input.day_portion,
					normalizeReason(input.reason),
					user.id,
					input.date,
					requestedDays,
					user.id,
					cycle.cycleStart,
					cycle.cycleEnd,
					DEFAULT_WFH_ALLOWANCE,
				)
				.run();
		} catch (error) {
			if (isSqliteWfhDateUniqueConstraintError(error)) {
				return {
					error: getExistingWfhDateError("concurrent_request"),
				};
			}
			throw error;
		}

		if (insertResult.meta.changes !== 1) {
			const concurrentRequest = await db
				.select({ id: wfhRequests.id })
				.from(wfhRequests)
				.where(
					and(
						eq(wfhRequests.userId, user.id),
						eq(wfhRequests.date, input.date),
					),
				)
				.limit(1);
			if (concurrentRequest.length > 0) {
				return {
					error: getExistingWfhDateError("concurrent_request"),
				};
			}
			return {
				error: `This request exceeds your WFH allowance. You have ${quota.remaining} day${quota.remaining === 1 ? "" : "s"} remaining in this cycle.`,
			};
		}

		const approvalsUrl = "/approvals";
		const requesterName = user.name ?? "A team member";
		const displayDate = formatDateDisplay(input.date);
		const requestSummary = `${requesterName} applied for WFH on ${displayDate}.`;
		const reasonLine = input.reason
			? `Reason: ${input.reason}`
			: "Reason: Not provided";

		await notifyApprovers(db, {
			requesterId: user.id,
			type: "wfh_requested",
			title: `WFH request from ${requesterName}`,
			body: `${requestSummary} ${reasonLine}`,
			relatedId: requestId,
			relatedType: "wfh_request",
			actionUrl: approvalsUrl,
			emailSubject: `WFH request: ${requesterName} (${displayDate})`,
			emailBody: [
				requestSummary,
				reasonLine,
				"",
				"Please review this request in Brainee.org.",
			].join("\n"),
		});

		return { success: true };
	});

export const cancelWfhRequest = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => {
		return z.string().parse(data);
	})
	.handler(async ({ data: id }) => {
		const user = await getCurrentAppUser();
		if (!user) {
			return { error: "Unauthorized" };
		}

		const db = createDb(env.DATABASE);

		const [request] = await db
			.select()
			.from(wfhRequests)
			.where(
				and(
					eq(wfhRequests.id, id),
					eq(wfhRequests.userId, user.id),
					inArray(wfhRequests.status, ["pending", "approved"]),
				),
			)
			.limit(1);

		if (!request) {
			return { error: "WFH request not found or cannot be cancelled." };
		}

		const nextStatus = getLeaveCancellationTargetStatus(request.status);

		if (!nextStatus) {
			return {
				error: "Cannot cancel a request that is not pending or approved.",
			};
		}

		await db
			.update(wfhRequests)
			.set({
				status: nextStatus,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(wfhRequests.id, id),
					eq(wfhRequests.userId, user.id),
					eq(wfhRequests.status, request.status),
				),
			);

		const isPending = request.status === "pending";
		const approvalsUrl = "/approvals";
		const requesterName = user.name ?? "A team member";
		const displayDate = formatDateDisplay(request.date);

		if (isPending) {
			const requestSummary = `${requesterName} cancelled their WFH request for ${displayDate}.`;
			const reasonLine = request.reason
				? `Original reason: ${request.reason}`
				: "Original reason: Not provided";

			await notifyApprovers(db, {
				requesterId: user.id,
				type: "wfh_cancelled",
				title: `WFH request cancelled by ${requesterName}`,
				body: `${requestSummary} ${reasonLine}`,
				relatedId: request.id,
				relatedType: "wfh_request",
				actionUrl: approvalsUrl,
				emailSubject: `WFH cancelled: ${requesterName} (${displayDate})`,
				emailBody: [
					requestSummary,
					reasonLine,
					"",
					"No action is required.",
				].join("\n"),
			});
		} else {
			const requestSummary = `${requesterName} requested cancellation for their approved WFH for ${displayDate}.`;

			await notifyApprovers(db, {
				requesterId: user.id,
				type: "wfh_cancelled",
				title: `WFH cancellation requested by ${requesterName}`,
				body: requestSummary,
				relatedId: request.id,
				relatedType: "wfh_request",
				actionUrl: approvalsUrl,
				emailSubject: `WFH Cancellation Requested: ${requesterName} (${displayDate})`,
				emailBody: [
					requestSummary,
					"",
					"Please review this cancellation request in Brainee.org approvals.",
				].join("\n"),
			});
		}

		return { success: true };
	});
