import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { createDb } from "../db";
import {
	projectDailyUpdateItems,
	projectDailyUpdates,
	projectMembers,
	projects,
	projectTasks,
	users,
} from "../db/schema";
import { getTodayIsoDate } from "../lib/leave-policy";
import { assertProjectAccess } from "../lib/project-access";
import { authMiddleware } from "../lib/server-fn";
import { getProjectDailyUpdatesSchema } from "./project-daily-updates-schema";

export const getProjectDailyUpdates = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => getProjectDailyUpdatesSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		const access = await assertProjectAccess(
			db,
			context.user,
			input.projectId,
			"viewer",
		);

		const updates = await db
			.select({
				id: projectDailyUpdates.id,
				projectId: projectDailyUpdates.projectId,
				userId: projectDailyUpdates.userId,
				userName: users.name,
				userEmail: users.email,
				userAvatarUrl: users.avatarUrl,
				date: projectDailyUpdates.date,
				summary: projectDailyUpdates.summary,
				blockers: projectDailyUpdates.blockers,
				hoursSpent: projectDailyUpdates.hoursSpent,
				status: projectDailyUpdates.status,
				submittedAt: projectDailyUpdates.submittedAt,
				createdAt: projectDailyUpdates.createdAt,
			})
			.from(projectDailyUpdates)
			.innerJoin(users, eq(projectDailyUpdates.userId, users.id))
			.where(
				and(
					eq(projectDailyUpdates.projectId, input.projectId),
					eq(projectDailyUpdates.date, input.date),
				),
			)
			.orderBy(desc(projectDailyUpdates.submittedAt));

		const updateIds = updates.map((u) => u.id);
		let itemsMap: Record<
			string,
			Array<{
				id: string;
				taskId: string;
				taskNumber: number;
				taskTitle: string;
				note: string | null;
				progressNote: string | null;
			}>
		> = {};

		if (updateIds.length > 0) {
			const allItems = await db
				.select({
					id: projectDailyUpdateItems.id,
					updateId: projectDailyUpdateItems.updateId,
					taskId: projectDailyUpdateItems.taskId,
					taskNumber: projectTasks.taskNumber,
					taskTitle: projectTasks.title,
					note: projectDailyUpdateItems.note,
					progressNote: projectDailyUpdateItems.progressNote,
				})
				.from(projectDailyUpdateItems)
				.leftJoin(
					projectTasks,
					eq(projectDailyUpdateItems.taskId, projectTasks.id),
				)
				.where(inArray(projectDailyUpdateItems.updateId, updateIds));

			itemsMap = allItems.reduce(
				(acc, cur) => {
					if (!acc[cur.updateId]) acc[cur.updateId] = [];
					acc[cur.updateId].push({
						id: cur.id,
						taskId: cur.taskId,
						taskNumber: cur.taskNumber || 0,
						taskTitle: cur.taskTitle || "Task",
						note: cur.note,
						progressNote: cur.progressNote,
					});
					return acc;
				},
				{} as typeof itemsMap,
			);
		}

		return {
			updates: updates.map((u) => ({
				...u,
				items: itemsMap[u.id] || [],
			})),
			access,
			today: getTodayIsoDate(),
		};
	});

export const getMyDashboardDailyUpdates = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const db = createDb(env.DATABASE);
		const today = getTodayIsoDate();

		const myMemberships = await db
			.select({
				projectId: projectMembers.projectId,
				projectCode: projects.code,
				projectName: projects.name,
			})
			.from(projectMembers)
			.innerJoin(projects, eq(projectMembers.projectId, projects.id))
			.where(
				and(
					eq(projectMembers.userId, context.user.id),
					eq(projectMembers.isCurrent, true),
					sql`${projectMembers.role} != 'viewer'`,
					sql`${projects.status} = 'active'`,
				),
			);

		if (myMemberships.length === 0) {
			return { today, projects: [] };
		}

		const projectIds = myMemberships.map((m) => m.projectId);
		const updates = await db
			.select({
				projectId: projectDailyUpdates.projectId,
				status: projectDailyUpdates.status,
				hoursSpent: projectDailyUpdates.hoursSpent,
			})
			.from(projectDailyUpdates)
			.where(
				and(
					eq(projectDailyUpdates.userId, context.user.id),
					eq(projectDailyUpdates.date, today),
					inArray(projectDailyUpdates.projectId, projectIds),
				),
			);

		const updatesByProject = new Map(updates.map((u) => [u.projectId, u]));

		const resultProjects = myMemberships.map((m) => {
			const u = updatesByProject.get(m.projectId);
			return {
				projectId: m.projectId,
				projectCode: m.projectCode,
				projectName: m.projectName,
				hasSubmitted: u?.status === "submitted",
				status: u?.status,
				hoursSpent: u?.hoursSpent,
			};
		});

		return { today, projects: resultProjects };
	});
