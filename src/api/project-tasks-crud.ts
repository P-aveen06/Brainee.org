import { createServerFn } from "@tanstack/react-start";
import { eq } from "@/db/graph-query";
import { createDb } from "../db";
import { projectEvents, projectTasks } from "../db/schema";
import { assertProjectAccess, meetsAccessLevel } from "../lib/project-access";
import { createTaskCore } from "../lib/project-task-create.server";
import { authMiddleware } from "../lib/server-fn";
import {
	createTaskSchema,
	deleteTaskSchema,
	updateTaskSchema,
} from "./project-tasks-schema";

export const createTask = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => createTaskSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		return createTaskCore(db, context.user, input);
	});

export const updateTask = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => updateTaskSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		const targetId = input.id || input.taskId || "";

		const [existing] = await db
			.select()
			.from(projectTasks)
			.where(eq(projectTasks.id, targetId))
			.limit(1);

		if (!existing) return { error: "Task not found." };

		const projectId = input.projectId || existing.projectId;
		const access = await assertProjectAccess(
			db,
			context.user,
			projectId,
			"contributor",
		);

		if (!meetsAccessLevel(access.role, "manager")) {
			if (
				existing.createdById !== context.user.id &&
				existing.assigneeId !== context.user.id
			) {
				return {
					error: "You can only edit tasks you created or are assigned to.",
				};
			}
		}

		await db
			.update(projectTasks)
			.set({
				title: input.title ? input.title.trim() : existing.title,
				description:
					input.description !== undefined
						? input.description?.trim() || null
						: existing.description,
				priority: input.priority || existing.priority,
				stageKey:
					input.stageKey !== undefined ? input.stageKey : existing.stageKey,
				assigneeId:
					input.assigneeId !== undefined
						? input.assigneeId
						: existing.assigneeId,
				startDate:
					input.startDate !== undefined ? input.startDate : existing.startDate,
				dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
				estimateHours:
					input.estimateHours !== undefined
						? input.estimateHours
						: existing.estimateHours,
				actualHours:
					input.actualHours !== undefined
						? input.actualHours
						: existing.actualHours,
				updatedAt: new Date(),
			})
			.where(eq(projectTasks.id, targetId));

		await db.insert(projectEvents).values({
			id: crypto.randomUUID(),
			projectId,
			eventType: "task_updated",
			actorId: context.user.id,
			entityType: "task",
			entityId: targetId,
			details: JSON.stringify({
				taskNumber: existing.taskNumber,
				title: input.title || existing.title,
			}),
			createdAt: new Date(),
		});

		return { success: true };
	});

export const deleteTask = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => deleteTaskSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		const targetId = input.id || input.taskId || "";

		const [existing] = await db
			.select()
			.from(projectTasks)
			.where(eq(projectTasks.id, targetId))
			.limit(1);

		if (!existing) return { error: "Task not found." };

		const projectId = input.projectId || existing.projectId;
		await assertProjectAccess(db, context.user, projectId, "manager");

		await db
			.delete(projectTasks)
			.where(eq(projectTasks.parentTaskId, targetId));

		await db.delete(projectTasks).where(eq(projectTasks.id, targetId));

		await db.insert(projectEvents).values({
			id: crypto.randomUUID(),
			projectId,
			eventType: "task_deleted",
			actorId: context.user.id,
			entityType: "task",
			entityId: targetId,
			details: JSON.stringify({
				taskNumber: existing.taskNumber,
				title: existing.title,
			}),
			createdAt: new Date(),
		});

		return { success: true };
	});
