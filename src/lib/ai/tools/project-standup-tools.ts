import { and, eq, ne } from "drizzle-orm";
import {
	projectDailyUpdates,
	projectEodReports,
	projectMembers,
	projectTasks,
	users,
} from "@/db/schema";
import { resolveEodSubmissionState } from "@/lib/eod-policy";
import { getTodayIsoDate } from "@/lib/leave-policy";
import { assertProjectAccess } from "@/lib/project-access";
import type { ToolHandler } from "./tool-types";

export const getDailyUpdatesTool: ToolHandler = {
	name: "get_daily_updates",
	description:
		"Get daily standup submissions for a project on a given date (defaults to today).",
	parameters: {
		type: "object",
		properties: {
			projectId: { type: "string", description: "The project ID" },
			date: {
				type: "string",
				description: "ISO date YYYY-MM-DD (defaults to today)",
			},
		},
		required: ["projectId"],
	},
	async execute(args, ctx) {
		const projectId = String(args.projectId);
		let canonicalId = projectId;
		try {
			const access = await assertProjectAccess(
				ctx.db,
				ctx.user,
				projectId,
				"viewer",
			);
			if (access.projectId) canonicalId = access.projectId;
		} catch {
			return { success: false, error: "Project not found." };
		}
		const date = typeof args.date === "string" ? args.date : getTodayIsoDate();

		const updates = await ctx.db
			.select({
				id: projectDailyUpdates.id,
				userName: users.name,
				summary: projectDailyUpdates.summary,
				blockers: projectDailyUpdates.blockers,
				hoursSpent: projectDailyUpdates.hoursSpent,
				status: projectDailyUpdates.status,
			})
			.from(projectDailyUpdates)
			.leftJoin(users, eq(projectDailyUpdates.userId, users.id))
			.where(
				and(
					eq(projectDailyUpdates.projectId, canonicalId),
					eq(projectDailyUpdates.date, date),
				),
			);

		return {
			success: true,
			data: { date, updates },
			groundedRecordIds: updates.map((u) => u.id),
			groundedLabels: updates.map((u) => ({
				id: u.id,
				label: u.userName || "unknown",
			})),
		};
	},
};

export const getEodStatusTool: ToolHandler = {
	name: "get_eod_status",
	description:
		"Check who has and hasn't submitted their daily update for a project on a given date " +
		"(defaults to today), and whether the EOD report has been generated.",
	parameters: {
		type: "object",
		properties: {
			projectId: { type: "string", description: "The project ID" },
			date: {
				type: "string",
				description: "ISO date YYYY-MM-DD (defaults to today)",
			},
		},
		required: ["projectId"],
	},
	async execute(args, ctx) {
		const projectId = String(args.projectId);
		let access: Awaited<ReturnType<typeof assertProjectAccess>>;
		let canonicalId = projectId;
		try {
			access = await assertProjectAccess(ctx.db, ctx.user, projectId, "viewer");
			if (access.projectId) canonicalId = access.projectId;
		} catch {
			return { success: false, error: "Project not found." };
		}
		const date = typeof args.date === "string" ? args.date : getTodayIsoDate();

		const [members, updates, [report]] = await Promise.all([
			ctx.db
				.select({
					userId: projectMembers.userId,
					userName: users.name,
					role: projectMembers.role,
					isCurrent: projectMembers.isCurrent,
				})
				.from(projectMembers)
				.leftJoin(users, eq(projectMembers.userId, users.id))
				.where(eq(projectMembers.projectId, canonicalId)),
			ctx.db
				.select({
					userId: projectDailyUpdates.userId,
					status: projectDailyUpdates.status,
				})
				.from(projectDailyUpdates)
				.where(
					and(
						eq(projectDailyUpdates.projectId, canonicalId),
						eq(projectDailyUpdates.date, date),
					),
				),
			ctx.db
				.select({ status: projectEodReports.status })
				.from(projectEodReports)
				.where(
					and(
						eq(projectEodReports.projectId, canonicalId),
						eq(projectEodReports.date, date),
					),
				)
				.limit(1),
		]);

		const state = resolveEodSubmissionState({
			members,
			submittedUpdates: updates,
			callerRole: access.role,
		});

		return {
			success: true,
			data: { date, ...state, reportStatus: report?.status ?? null },
			groundedRecordIds: state.expected.map((m) => m.userId),
			groundedLabels: state.expected.map((m) => ({
				id: m.userId,
				label: m.name,
			})),
		};
	},
};

export const getWorkloadTool: ToolHandler = {
	name: "get_workload",
	description:
		"Get how open tasks are distributed across a project's team — who's holding how many open " +
		"tasks and estimated hours. Only for members of the project or admins.",
	parameters: {
		type: "object",
		properties: {
			projectId: { type: "string", description: "The project ID" },
		},
		required: ["projectId"],
	},
	async execute(args, ctx) {
		const projectId = String(args.projectId);
		let canonicalId = projectId;
		try {
			const access = await assertProjectAccess(
				ctx.db,
				ctx.user,
				projectId,
				"viewer",
			);
			if (access.projectId) canonicalId = access.projectId;
		} catch {
			return { success: false, error: "Project not found." };
		}

		const [tasks, members] = await Promise.all([
			ctx.db
				.select({
					assigneeId: projectTasks.assigneeId,
					estimateHours: projectTasks.estimateHours,
				})
				.from(projectTasks)
				.where(
					and(
						eq(projectTasks.projectId, canonicalId),
						ne(projectTasks.status, "done"),
						ne(projectTasks.status, "cancelled"),
					),
				),
			ctx.db
				.select({ userId: projectMembers.userId, userName: users.name })
				.from(projectMembers)
				.leftJoin(users, eq(projectMembers.userId, users.id))
				.where(
					and(
						eq(projectMembers.projectId, canonicalId),
						eq(projectMembers.isCurrent, true),
					),
				),
		]);

		const nameMap = new Map(members.map((m) => [m.userId, m.userName]));
		const byAssignee = new Map<
			string,
			{ openTasks: number; estimatedHours: number }
		>();
		let unassignedOpenTasks = 0;

		for (const t of tasks) {
			if (!t.assigneeId) {
				unassignedOpenTasks++;
				continue;
			}
			const entry = byAssignee.get(t.assigneeId) || {
				openTasks: 0,
				estimatedHours: 0,
			};
			entry.openTasks += 1;
			entry.estimatedHours += t.estimateHours || 0;
			byAssignee.set(t.assigneeId, entry);
		}

		const workload = Array.from(byAssignee.entries()).map(
			([userId, stats]) => ({
				userId,
				userName: nameMap.get(userId) || "unknown",
				...stats,
			}),
		);

		return {
			success: true,
			data: { projectId, workload, unassignedOpenTasks },
			groundedRecordIds: workload.map((w) => w.userId),
			groundedLabels: workload.map((w) => ({
				id: w.userId,
				label: w.userName,
			})),
		};
	},
};
