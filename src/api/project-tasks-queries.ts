import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	like,
	lower,
	or,
} from "@/db/graph-query";
import { createServerFn } from "@tanstack/react-start";
import { createDb } from "../db";
import { projects, projectTasks, users } from "../db/schema";
import { getTodayIsoDate } from "../lib/leave-policy";
import {
	assertProjectAccess,
	visibleProjectIdsFor,
} from "../lib/project-access";
import { authMiddleware } from "../lib/server-fn";
import { getProjectTasksSchema } from "./project-tasks-schema";

export const getProjectTasks = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => getProjectTasksSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		const access = await assertProjectAccess(
			db,
			context.user,
			input.projectId,
			"viewer",
		);

		const conditions = [eq(projectTasks.projectId, input.projectId)];

		if (input.status && input.status !== "all") {
			conditions.push(eq(projectTasks.status, input.status));
		}
		if (input.priority && input.priority !== "all") {
			conditions.push(eq(projectTasks.priority, input.priority));
		}
		if (input.stageKey && input.stageKey !== "all") {
			conditions.push(eq(projectTasks.stageKey, input.stageKey));
		}
		if (input.assigneeId && input.assigneeId !== "all") {
			if (input.assigneeId === "unassigned") {
				conditions.push(isNull(projectTasks.assigneeId));
			} else {
				conditions.push(eq(projectTasks.assigneeId, input.assigneeId));
			}
		}
		if (input.q?.trim()) {
			const query = `%${input.q.trim().toLowerCase()}%`;
			const searchFilter = or(
				like(lower(projectTasks.title), query),
				like(lower(projectTasks.description), query),
			);
			if (searchFilter) {
				conditions.push(searchFilter);
			}
		}

		// Query tasks
		const rawTasks = await db
			.select({
				id: projectTasks.id,
				projectId: projectTasks.projectId,
				stageKey: projectTasks.stageKey,
				parentTaskId: projectTasks.parentTaskId,
				taskNumber: projectTasks.taskNumber,
				title: projectTasks.title,
				description: projectTasks.description,
				status: projectTasks.status,
				priority: projectTasks.priority,
				assigneeId: projectTasks.assigneeId,
				assigneeName: users.name,
				assigneeEmail: users.email,
				assigneeAvatarUrl: users.avatarUrl,
				createdById: projectTasks.createdById,
				startDate: projectTasks.startDate,
				dueDate: projectTasks.dueDate,
				completedAt: projectTasks.completedAt,
				estimateHours: projectTasks.estimateHours,
				actualHours: projectTasks.actualHours,
				blockedReason: projectTasks.blockedReason,
				sequence: projectTasks.sequence,
				createdAt: projectTasks.createdAt,
				updatedAt: projectTasks.updatedAt,
			})
			.from(projectTasks)
			.leftJoin(users, eq(projectTasks.assigneeId, users.id))
			.where(and(...conditions))
			.orderBy(asc(projectTasks.sequence), desc(projectTasks.createdAt))
			.limit(input.limit);

		// Get all project tasks status counts for KPI summary
		const allCounts = await db
			.select({
				status: projectTasks.status,
				count: count(),
			})
			.from(projectTasks)
			.where(eq(projectTasks.projectId, input.projectId))
			.groupBy(projectTasks.status);

		const summary = {
			total: 0,
			todo: 0,
			in_progress: 0,
			blocked: 0,
			in_review: 0,
			done: 0,
			cancelled: 0,
		};

		for (const row of allCounts) {
			const st = row.status as keyof typeof summary;
			if (st in summary) {
				summary[st] = Number(row.count);
				summary.total += Number(row.count);
			}
		}

		// Count subtasks per parent
		const subtaskCounts = await db
			.select({
				parentTaskId: projectTasks.parentTaskId,
				count: count(),
			})
			.from(projectTasks)
			.where(
				and(
					eq(projectTasks.projectId, input.projectId),
					isNotNull(projectTasks.parentTaskId),
				),
			)
			.groupBy(projectTasks.parentTaskId);

		const subtaskMap: Record<string, number> = {};
		for (const row of subtaskCounts) {
			if (row.parentTaskId) {
				subtaskMap[row.parentTaskId] = Number(row.count);
			}
		}

		const tasks = rawTasks.map((t) => ({
			...t,
			subtaskCount: subtaskMap[t.id] || 0,
		}));

		return {
			tasks,
			summary,
			access,
			today: getTodayIsoDate(),
		};
	});

export const getMyTasks = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const db = createDb();
		const visibleIds = await visibleProjectIdsFor(db, context.user);

		if (Array.isArray(visibleIds) && visibleIds.length === 0) {
			return {
				tasks: [],
				summary: { total: 0, overdue: 0, dueToday: 0, inProgress: 0, done: 0 },
				today: getTodayIsoDate(),
			};
		}

		const whereConditions = [eq(projectTasks.assigneeId, context.user.id)];
		if (Array.isArray(visibleIds)) {
			whereConditions.push(inArray(projectTasks.projectId, visibleIds));
		}

		const myTasks = await db
			.select({
				id: projectTasks.id,
				projectId: projectTasks.projectId,
				projectCode: projects.code,
				projectName: projects.name,
				stageKey: projectTasks.stageKey,
				parentTaskId: projectTasks.parentTaskId,
				taskNumber: projectTasks.taskNumber,
				title: projectTasks.title,
				description: projectTasks.description,
				status: projectTasks.status,
				priority: projectTasks.priority,
				assigneeId: projectTasks.assigneeId,
				startDate: projectTasks.startDate,
				dueDate: projectTasks.dueDate,
				completedAt: projectTasks.completedAt,
				estimateHours: projectTasks.estimateHours,
				actualHours: projectTasks.actualHours,
				blockedReason: projectTasks.blockedReason,
				createdAt: projectTasks.createdAt,
			})
			.from(projectTasks)
			.innerJoin(projects, eq(projectTasks.projectId, projects.id))
			.where(and(...whereConditions))
			.orderBy(asc(projectTasks.dueDate), desc(projectTasks.createdAt))
			.limit(500);

		const todayStr = getTodayIsoDate();

		let overdue = 0;
		let dueToday = 0;
		let inProgress = 0;
		let done = 0;

		for (const t of myTasks) {
			if (t.status === "done") {
				done++;
			} else if (t.status !== "cancelled") {
				if (t.status === "in_progress") inProgress++;
				if (t.dueDate) {
					if (t.dueDate < todayStr) overdue++;
					else if (t.dueDate === todayStr) dueToday++;
				}
			}
		}

		return {
			tasks: myTasks,
			summary: {
				total: myTasks.length,
				overdue,
				dueToday,
				inProgress,
				done,
			},
			today: todayStr,
		};
	});
