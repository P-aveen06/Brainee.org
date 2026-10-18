import { and, eq, gte, inArray, lte } from "@/db/graph-query";
import { leaveRequests, users, wfhRequests } from "@/db/schema";
import {
	ACTIONABLE_LEAVE_APPROVAL_STATUSES,
	ACTIONABLE_WFH_APPROVAL_STATUSES,
} from "@/lib/approval-count.server";
import { addIsoDays, getTodayIsoDate } from "@/lib/leave-policy";
import { resolveRelativeDate } from "../normalization/relative-date";
import { callerPersona, callerTitle } from "../persona-context";
import type { ToolHandler } from "./tool-types";

export const getTeamAvailabilityTool: ToolHandler = {
	name: "get_team_availability",
	description:
		"Check team availability, approved leaves, and WFH schedules for a date or date range.",
	parameters: {
		type: "object",
		properties: {
			startDate: {
				type: "string",
				description: "ISO date YYYY-MM-DD (defaults to today)",
			},
			endDate: {
				type: "string",
				description: "ISO date YYYY-MM-DD (defaults to 7 days from start)",
			},
		},
	},
	async execute(args, ctx) {
		let start = getTodayIsoDate();
		if (typeof args.startDate === "string" && args.startDate.trim()) {
			const res = resolveRelativeDate(args.startDate.trim(), start);
			if (res.status === "resolved") {
				start = res.isoDate;
			}
		}

		let end = addIsoDays(start, 7);
		if (typeof args.endDate === "string" && args.endDate.trim()) {
			const res = resolveRelativeDate(args.endDate.trim(), start);
			if (res.status === "resolved") {
				end = res.isoDate;
			}
		}

		const [leaves, wfhs] = await Promise.all([
			ctx.db
				.select()
				.from(leaveRequests)
				.where(
					and(
						eq(leaveRequests.status, "approved"),
						lte(leaveRequests.startDate, end),
						gte(leaveRequests.endDate, start),
					),
				),
			ctx.db
				.select()
				.from(wfhRequests)
				.where(
					and(
						eq(wfhRequests.status, "approved"),
						gte(wfhRequests.date, start),
						lte(wfhRequests.date, end),
					),
				),
		]);

		const relevantUserIds = Array.from(
			new Set([...leaves.map((l) => l.userId), ...wfhs.map((w) => w.userId)]),
		);

		const team =
			relevantUserIds.length > 0
				? await ctx.db
						.select({ id: users.id, name: users.name })
						.from(users)
						.where(inArray(users.id, relevantUserIds))
				: [];

		const userNames = new Map(team.map((u) => [u.id, u.name]));

		return {
			success: true,
			data: {
				dateRange: { start, end },
				onLeave: leaves.map((l) => ({
					userName: userNames.get(l.userId) || l.userId,
					leaveType: l.leaveType,
					startDate: l.startDate,
					endDate: l.endDate,
					totalDays: l.totalDays,
				})),
				workingFromHome: wfhs.map((w) => ({
					userName: userNames.get(w.userId) || w.userId,
					date: w.date,
					isHalfDay: w.isHalfDay,
				})),
			},
			groundedRecordIds: [...leaves.map((l) => l.id), ...wfhs.map((w) => w.id)],
			groundedLabels: [
				...leaves.map((l) => ({
					id: l.id,
					label: userNames.get(l.userId) || l.userId,
				})),
				...wfhs.map((w) => ({
					id: w.id,
					label: userNames.get(w.userId) || w.userId,
				})),
			],
		};
	},
};

export const getPendingApprovalsTool: ToolHandler = {
	name: "get_pending_approvals",
	description:
		"Get counts and details of pending leave and WFH approval requests (for Leads and Admins).",
	parameters: { type: "object", properties: {} },
	async execute(_args, ctx) {
		if (ctx.user.role !== "admin" && ctx.user.role !== "lead") {
			return {
				success: false,
				error: "Only team leads and administrators can view pending approvals.",
			};
		}

		const team = await ctx.db
			.select({ id: users.id, name: users.name, email: users.email })
			.from(users)
			.where(
				and(
					eq(users.isActive, true),
					ctx.user.role === "lead"
						? eq(users.peerLeadId, ctx.user.id)
						: undefined,
				),
			);
		const ids = team.map((person) => person.id);
		const [leaves, wfhs] = ids.length
			? await Promise.all([
					ctx.db
						.select()
						.from(leaveRequests)
						.where(
							and(
								inArray(
									leaveRequests.status,
									ACTIONABLE_LEAVE_APPROVAL_STATUSES,
								),
								inArray(leaveRequests.userId, ids),
							),
						),
					ctx.db
						.select()
						.from(wfhRequests)
						.where(
							and(
								inArray(wfhRequests.status, ACTIONABLE_WFH_APPROVAL_STATUSES),
								inArray(wfhRequests.userId, ids),
							),
						),
				])
			: [[], []];

		const userMap = new Map(team.map((u) => [u.id, u]));

		return {
			success: true,
			data: {
				totalPending: leaves.length + wfhs.length,
				pendingLeaves: leaves.map((l) => ({
					id: l.id,
					applicant: userMap.get(l.userId)?.name || l.userId,
					leaveType: l.leaveType,
					startDate: l.startDate,
					endDate: l.endDate,
					totalDays: l.totalDays,
					reason: l.reason,
				})),
				pendingWfh: wfhs.map((w) => ({
					id: w.id,
					applicant: userMap.get(w.userId)?.name || w.userId,
					date: w.date,
					isHalfDay: w.isHalfDay,
				})),
			},
			groundedRecordIds: [...leaves.map((l) => l.id), ...wfhs.map((w) => w.id)],
			groundedLabels: [
				...leaves.map((l) => ({
					id: l.id,
					label: userMap.get(l.userId)?.name || l.userId,
				})),
				...wfhs.map((w) => ({
					id: w.id,
					label: userMap.get(w.userId)?.name || w.userId,
				})),
			],
		};
	},
};

export const searchTeamMembersTool: ToolHandler = {
	name: "search_team_members",
	description:
		"Search colleagues and team members across the company by name, email, role, or reporting structure. " +
		"Use whenever someone asks 'who is X', 'find email for X', 'who reports to X', or 'list team leads'.",
	parameters: {
		type: "object",
		properties: {
			query: {
				type: "string",
				description:
					"Search name or email (e.g. 'Charan', 'Sneha', 'vikram@company.com')",
			},
			role: {
				type: "string",
				enum: ["admin", "lead", "user", "hr"],
				description: "Filter by system role",
			},
			leadName: {
				type: "string",
				description: "Find members who report to this manager/lead name",
			},
		},
	},
	async execute(args, ctx) {
		const allUsers = await ctx.db
			.select({
				id: users.id,
				authId: users.authId,
				name: users.name,
				email: users.email,
				role: users.role,
				peerLeadId: users.peerLeadId,
				isActive: users.isActive,
				joinDate: users.joinDate,
			})
			.from(users);

		const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

		let filtered = allUsers.filter((u) => u.isActive);

		if (typeof args.role === "string" && args.role) {
			filtered = filtered.filter((u) => u.role === args.role);
		}

		if (typeof args.query === "string" && args.query.trim()) {
			const q = args.query.trim().toLowerCase();
			filtered = filtered.filter(
				(u) =>
					u.name.toLowerCase().includes(q) ||
					u.email.toLowerCase().includes(q) ||
					callerTitle(u).toLowerCase().includes(q) ||
					callerPersona(u).includes(q),
			);
		}

		if (typeof args.leadName === "string" && args.leadName.trim()) {
			const lq = args.leadName.trim().toLowerCase();
			const matchingLeads = allUsers.filter((u) =>
				u.name.toLowerCase().includes(lq),
			);
			const matchingLeadIds = new Set(matchingLeads.map((u) => u.id));
			filtered = filtered.filter(
				(u) => u.peerLeadId && matchingLeadIds.has(u.peerLeadId),
			);
		}

		const limited = filtered.slice(0, 25);

		return {
			success: true,
			data: limited.map((u) => ({
				id: u.id,
				name: u.name,
				email: u.email,
				role: u.role,
				jobTitle: callerTitle(u),
				manager: u.peerLeadId ? userMap.get(u.peerLeadId) || "Unknown" : "None",
				joinDate: u.joinDate,
			})),
			hasMore: filtered.length > 25,
			totalMatches: filtered.length,
			groundedRecordIds: limited.map((u) => u.id),
			groundedLabels: limited.map((u) => ({ id: u.id, label: u.name })),
		};
	},
};
