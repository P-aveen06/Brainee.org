import { and, desc, eq } from "@/db/graph-query";
import {
	leaveBalances,
	leaveRequests,
	systemLeaveTypes,
	wfhPolicy,
	wfhRequests,
} from "@/db/schema";
import { getTodayIsoDate } from "@/lib/leave-policy";
import { previewLeaveRequest } from "@/lib/leave-preview.server";
import { resolveLeaveType } from "../normalization/leave-type";
import { resolveRelativeDate } from "../normalization/relative-date";
import type { ToolHandler } from "./tool-types";

export const getMyLeaveBalancesTool: ToolHandler = {
	name: "get_my_leave_balances",
	description:
		"Get the current authenticated user's leave balances, allocated days, used days, and WFH allowance.",
	parameters: { type: "object", properties: {} },
	async execute(_args, ctx) {
		const [balances, sysTypes, [policy]] = await Promise.all([
			ctx.db
				.select()
				.from(leaveBalances)
				.where(eq(leaveBalances.userId, ctx.user.id)),
			ctx.db.select().from(systemLeaveTypes),
			ctx.db.select().from(wfhPolicy).where(eq(wfhPolicy.id, 1)).limit(1),
		]);

		const typesMap = new Map(sysTypes.map((t) => [t.slug, t.name]));

		const balanceData = balances.map((b) => ({
			leaveTypeCode: b.leaveType,
			leaveTypeName: typesMap.get(b.leaveType) || b.leaveType,
			allocatedDays: b.totalLimit,
			usedDays: b.used,
			remainingDays: Math.max(0, b.totalLimit - b.used),
		}));

		return {
			success: true,
			data: {
				userId: ctx.user.id,
				leaveBalances: balanceData,
				annualWfhAllowanceDays: policy?.annualAllowance ?? 12,
			},
			groundedRecordIds: balances.map((b) => b.id),
			groundedLabels: balances.map((b) => ({
				id: b.id,
				label: typesMap.get(b.leaveType) || b.leaveType,
			})),
		};
	},
};

export const getMyLeaveRequestsTool: ToolHandler = {
	name: "get_my_leave_requests",
	description:
		"Get recent leave and WFH requests submitted by the current user.",
	parameters: {
		type: "object",
		properties: {
			status: {
				type: "string",
				description: "Filter by status: pending, approved, rejected",
			},
		},
	},
	async execute(args, ctx) {
		const conditions = [eq(leaveRequests.userId, ctx.user.id)];
		if (typeof args.status === "string" && args.status.trim()) {
			conditions.push(
				eq(
					leaveRequests.status,
					args.status as typeof leaveRequests.$inferSelect.status,
				),
			);
		}

		const [leaves, wfhs] = await Promise.all([
			ctx.db
				.select({
					id: leaveRequests.id,
					leaveType: leaveRequests.leaveType,
					leaveTypeName: systemLeaveTypes.name,
					startDate: leaveRequests.startDate,
					endDate: leaveRequests.endDate,
					totalDays: leaveRequests.totalDays,
					status: leaveRequests.status,
					reason: leaveRequests.reason,
				})
				.from(leaveRequests)
				.leftJoin(
					systemLeaveTypes,
					eq(systemLeaveTypes.slug, leaveRequests.leaveType),
				)
				.where(and(...conditions))
				.orderBy(desc(leaveRequests.createdAt))
				.limit(20),
			ctx.db
				.select()
				.from(wfhRequests)
				.where(eq(wfhRequests.userId, ctx.user.id))
				.orderBy(desc(wfhRequests.createdAt))
				.limit(20),
		]);

		return {
			success: true,
			data: {
				leaves: leaves.map((l) => ({
					id: l.id,
					leaveType: l.leaveTypeName || l.leaveType,
					startDate: l.startDate,
					endDate: l.endDate,
					totalDays: l.totalDays,
					status: l.status,
					reason: l.reason,
				})),
				wfh: wfhs.filter(w => !args.status || w.status === args.status).map((w) => ({
					id: w.id,
					date: w.date,
					isHalfDay: w.isHalfDay,
					status: w.status,
					reason: w.reason,
				})),
			},
			groundedRecordIds: [...leaves.map((l) => l.id), ...wfhs.map((w) => w.id)],
			groundedLabels: [
				...leaves.map((l) => ({
					id: l.id,
					label: `${l.leaveType} ${l.startDate}`,
				})),
				...wfhs.map((w) => ({ id: w.id, label: `WFH ${w.date}` })),
			],
		};
	},
};

export const proposeLeaveRequestTool: ToolHandler = {
	name: "propose_leave_request",
	description:
		"Draft a leave request for the user. Emits an interactive confirmation card on screen. " +
		"Pass leaveType (e.g. 'sick', 'personal', 'casual') and startDate. If single-day leave, endDate defaults to startDate.",
	parameters: {
		type: "object",
		properties: {
			leaveType: {
				type: "string",
				description:
					"Leave type (e.g. 'sick', 'personal', 'casual', 'festival')",
			},
			startDate: {
				type: "string",
				description: "Start date YYYY-MM-DD",
			},
			endDate: {
				type: "string",
				description:
					"End date YYYY-MM-DD (defaults to startDate if single-day)",
			},
			reason: {
				type: "string",
				description: "Reason for the leave request (optional)",
			},
		},
		required: ["leaveType", "startDate"],
	},
	async execute(args, ctx) {
		const types = await ctx.db
			.select({ slug: systemLeaveTypes.slug, name: systemLeaveTypes.name })
			.from(systemLeaveTypes);

		const matched = resolveLeaveType(String(args.leaveType), types);
		if (!matched) {
			return {
				success: false,
				error: `"${args.leaveType}" isn't a recognized leave type. Available types: ${types.map((t) => t.name).join(", ")}.`,
			};
		}

		const today = getTodayIsoDate();
		const resolvedStart = resolveRelativeDate(String(args.startDate), today);
		if (resolvedStart.status !== "resolved") {
			return { success: false, error: resolvedStart.reason };
		}
		const resolvedEnd = args.endDate
			? resolveRelativeDate(String(args.endDate), today)
			: resolvedStart;
		if (resolvedEnd.status !== "resolved") {
			return { success: false, error: resolvedEnd.reason };
		}
		const startDate = resolvedStart.isoDate;
		const endDate = resolvedEnd.isoDate;
		if (endDate < startDate) {
			return {
				success: false,
				error: "End date cannot be before the start date.",
			};
		}
		const reason = args.reason
			? String(args.reason)
			: `${matched.name} application`;

		const preview = await previewLeaveRequest(ctx.db, ctx.user, {
			leaveType: matched.slug,
			startDate,
			endDate,
			reason,
		});
		if (!preview.success || preview.totalDays === undefined) {
			return {
				success: false,
				error: preview.error || "Leave request is invalid.",
			};
		}
		const days = preview.totalDays;

		return {
			success: true,
			data: {
				message: `Drafted leave request: ${days} day(s) of ${matched.name} from ${startDate} to ${endDate}.`,
				leaveType: matched.slug,
				leaveTypeName: matched.name,
				startDate,
				endDate,
				totalDays: days,
				remainingBefore: preview.remainingBefore,
				remainingAfter: preview.remainingAfter,
				policyWarning: preview.ruleViolationNote,
				reason,
			},
			groundedRecordIds: [],
			proposedAction: {
				actionType: "request_leave",
				targetEntityType: "leave_request",
				targetEntityId: "new",
				payload: {
					leaveType: matched.slug,
					leaveTypeName: matched.name,
					startDate,
					endDate,
					totalDays: days,
					reason,
				},
			},
		};
	},
};
