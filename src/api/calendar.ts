import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { aliasedTable, and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { createDb } from "../db";
import {
	leaveBalances,
	leaveRequests,
	publicHolidays,
	timesheets,
	users,
	wfhPolicy,
	wfhRequests,
} from "../db/schema";
import {
	addIsoDays,
	getTodayIsoDate,
	OPERATIONALLY_ACTIVE_LEAVE_STATUSES,
} from "../lib/leave-policy";
import { authMiddleware } from "../lib/server-fn";
import {
	DEFAULT_WFH_ALLOWANCE,
	getWfhCycleBounds,
	WFH_POLICY_ID,
} from "../lib/wfh-policy";

const approver = aliasedTable(users, "approver");
const rejecter = aliasedTable(users, "rejecter");
const revoker = aliasedTable(users, "revoker");

export const getCalendarData = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const user = context.user;
		const db = createDb(env.DATABASE);

		const today = getTodayIsoDate();
		const startIso = addIsoDays(today, -30);
		const endIso = addIsoDays(today, 30);

		const dbTimesheets = await db
			.select({
				date: timesheets.date,
				hours: timesheets.hours,
				status: timesheets.status,
				reEntryNote: timesheets.reEntryNote,
			})
			.from(timesheets)
			.where(
				and(
					eq(timesheets.userId, user.id),
					gte(timesheets.date, startIso),
					lte(timesheets.date, endIso),
				),
			);

		const dbLeaves = await db
			.select({
				leaveType: leaveRequests.leaveType,
				startDate: leaveRequests.startDate,
				endDate: leaveRequests.endDate,
				status: leaveRequests.status,
				isHalfDayStart: leaveRequests.isHalfDayStart,
				halfDayStartPeriod: leaveRequests.halfDayStartPeriod,
				isHalfDayEnd: leaveRequests.isHalfDayEnd,
				halfDayEndPeriod: leaveRequests.halfDayEndPeriod,
			})
			.from(leaveRequests)
			.where(
				and(
					eq(leaveRequests.userId, user.id),
					inArray(leaveRequests.status, [
						...OPERATIONALLY_ACTIVE_LEAVE_STATUSES,
						"pending",
					]),
				),
			);

		const dbWfhs = await db
			.select({
				date: wfhRequests.date,
				status: wfhRequests.status,
				isHalfDay: wfhRequests.isHalfDay,
				halfDayPeriod: wfhRequests.halfDayPeriod,
			})
			.from(wfhRequests)
			.where(
				and(
					eq(wfhRequests.userId, user.id),
					inArray(wfhRequests.status, ["approved", "pending"]),
					gte(wfhRequests.date, startIso),
					lte(wfhRequests.date, endIso),
				),
			);

		const dbHolidays = await db
			.select({
				date: publicHolidays.date,
				name: publicHolidays.name,
				year: publicHolidays.year,
			})
			.from(publicHolidays);

		const dbBalances = await db
			.select({
				leaveType: leaveBalances.leaveType,
				totalLimit: leaveBalances.totalLimit,
				used: leaveBalances.used,
				cycleStart: leaveBalances.cycleStart,
				cycleEnd: leaveBalances.cycleEnd,
			})
			.from(leaveBalances)
			.where(eq(leaveBalances.userId, user.id));

		// WFH balance for the current birthday-month cycle (only when a birthday
		// is set, since the cycle is anchored to it). Mirrors getWfhQuota.
		let wfhBalance: { total_limit: number; used: number } | null = null;
		if (user.birthday) {
			const cycle = getWfhCycleBounds(user.birthday, getTodayIsoDate());
			const [policyRow] = await db
				.select({ annualAllowance: wfhPolicy.annualAllowance })
				.from(wfhPolicy)
				.where(eq(wfhPolicy.id, WFH_POLICY_ID))
				.limit(1);
			const allowance = Number(
				policyRow?.annualAllowance ?? DEFAULT_WFH_ALLOWANCE,
			);
			const wfhRows = await db
				.select({ isHalfDay: wfhRequests.isHalfDay })
				.from(wfhRequests)
				.where(
					and(
						eq(wfhRequests.userId, user.id),
						gte(wfhRequests.date, cycle.cycleStart),
						lte(wfhRequests.date, cycle.cycleEnd),
						inArray(wfhRequests.status, ["pending", "approved"]),
					),
				);
			const used = wfhRows.reduce(
				(total, row) => total + (row.isHalfDay ? 0.5 : 1),
				0,
			);
			wfhBalance = { total_limit: allowance, used };
		}

		const detailedLeaves = await db
			.select({
				id: leaveRequests.id,
				leaveType: leaveRequests.leaveType,
				startDate: leaveRequests.startDate,
				endDate: leaveRequests.endDate,
				totalDays: leaveRequests.totalDays,
				status: leaveRequests.status,
				createdAt: leaveRequests.createdAt,
				updatedAt: leaveRequests.updatedAt,
				rejectionReason: leaveRequests.rejectionReason,
				revokeReason: leaveRequests.revokeReason,
				approvedBy: {
					id: approver.id,
					name: approver.name,
					email: approver.email,
					avatarUrl: approver.avatarUrl,
				},
				rejectedBy: {
					id: rejecter.id,
					name: rejecter.name,
					email: rejecter.email,
					avatarUrl: rejecter.avatarUrl,
				},
				revokedBy: {
					id: revoker.id,
					name: revoker.name,
					email: revoker.email,
					avatarUrl: revoker.avatarUrl,
				},
			})
			.from(leaveRequests)
			.leftJoin(approver, eq(leaveRequests.approvedBy, approver.id))
			.leftJoin(rejecter, eq(leaveRequests.rejectedBy, rejecter.id))
			.leftJoin(revoker, eq(leaveRequests.revokedBy, revoker.id))
			.where(eq(leaveRequests.userId, user.id))
			.orderBy(desc(leaveRequests.createdAt))
			.limit(100);

		const detailedWfhs = await db
			.select({
				id: wfhRequests.id,
				date: wfhRequests.date,
				status: wfhRequests.status,
				createdAt: wfhRequests.createdAt,
				updatedAt: wfhRequests.updatedAt,
				rejectionReason: wfhRequests.rejectionReason,
				revokeReason: wfhRequests.revokeReason,
				approvedBy: {
					id: approver.id,
					name: approver.name,
					email: approver.email,
					avatarUrl: approver.avatarUrl,
				},
				rejectedBy: {
					id: rejecter.id,
					name: rejecter.name,
					email: rejecter.email,
					avatarUrl: rejecter.avatarUrl,
				},
				revokedBy: {
					id: revoker.id,
					name: revoker.name,
					email: revoker.email,
					avatarUrl: revoker.avatarUrl,
				},
			})
			.from(wfhRequests)
			.leftJoin(approver, eq(wfhRequests.approvedBy, approver.id))
			.leftJoin(rejecter, eq(wfhRequests.rejectedBy, rejecter.id))
			.leftJoin(revoker, eq(wfhRequests.revokedBy, revoker.id))
			.where(eq(wfhRequests.userId, user.id))
			.orderBy(desc(wfhRequests.createdAt))
			.limit(100);

		return {
			timesheets: dbTimesheets.map((t) => ({
				date: t.date,
				hours: Number(t.hours),
				status: t.status,
				re_entry_note: t.reEntryNote,
			})),
			leaves: dbLeaves.map((l) => ({
				leave_type: l.leaveType,
				start_date: l.startDate,
				end_date: l.endDate,
				status: l.status,
				isHalfDayStart: l.isHalfDayStart,
				halfDayStartPeriod: l.halfDayStartPeriod,
				isHalfDayEnd: l.isHalfDayEnd,
				halfDayEndPeriod: l.halfDayEndPeriod,
			})),
			wfhs: dbWfhs.map((w) => ({
				date: w.date,
				status: w.status,
				isHalfDay: w.isHalfDay,
				halfDayPeriod: w.halfDayPeriod,
			})),
			holidays: dbHolidays.map((h) => ({
				date: h.date,
				name: h.name,
				year: h.year,
			})),
			balances: dbBalances.map((b) => ({
				leave_type: b.leaveType,
				total_limit: Number(b.totalLimit),
				used: Number(b.used),
				cycle_start: b.cycleStart,
				cycle_end: b.cycleEnd,
			})),
			wfhBalance,
			detailedLeaves: detailedLeaves.map((l) => ({
				id: l.id,
				leave_type: l.leaveType,
				start_date: l.startDate,
				end_date: l.endDate,
				total_days: Number(l.totalDays),
				status: l.status,
				created_at: l.createdAt ? l.createdAt.toISOString() : "",
				updated_at: l.updatedAt ? l.updatedAt.toISOString() : "",
				rejection_reason: l.rejectionReason,
				revoke_reason: l.revokeReason,
				approvedBy: l.approvedBy?.id
					? { ...l.approvedBy, avatar_url: l.approvedBy.avatarUrl }
					: null,
				rejectedBy: l.rejectedBy?.id
					? { ...l.rejectedBy, avatar_url: l.rejectedBy.avatarUrl }
					: null,
				revokedBy: l.revokedBy?.id
					? { ...l.revokedBy, avatar_url: l.revokedBy.avatarUrl }
					: null,
			})),
			detailedWfhs: detailedWfhs.map((w) => ({
				id: w.id,
				date: w.date,
				status: w.status,
				created_at: w.createdAt ? w.createdAt.toISOString() : "",
				updated_at: w.updatedAt ? w.updatedAt.toISOString() : "",
				rejection_reason: w.rejectionReason,
				revoke_reason: w.revokeReason,
				approvedBy: w.approvedBy?.id
					? { ...w.approvedBy, avatar_url: w.approvedBy.avatarUrl }
					: null,
				rejectedBy: w.rejectedBy?.id
					? { ...w.rejectedBy, avatar_url: w.rejectedBy.avatarUrl }
					: null,
				revokedBy: w.revokedBy?.id
					? { ...w.revokedBy, avatar_url: w.revokedBy.avatarUrl }
					: null,
			})),
		};
	});
