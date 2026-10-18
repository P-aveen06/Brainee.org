import { and, eq, ne, or } from "@/db/graph-query";
import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { createDb, type Database } from "../db";
import { projectEvents, projectTasks } from "../db/schema";
import { assertProjectAccess, meetsAccessLevel } from "../lib/project-access";
import { type AppUser, authMiddleware } from "../lib/server-fn";
import {
	bulkReassignTasksSchema,
	reassignTaskSchema,
	updateTaskStatusSchema,
} from "./project-tasks-schema";

/**
 * The single source of truth for changing a task's status — used by the server fn below
 * and by the AI assistant's proposal-confirmation flow, so an AI-confirmed change can never
 * bypass a validation or authorization rule the human UI path enforces.
 */
export async function updateTaskStatusCore(
	db: Database,
	user: AppUser,
	input: z.infer<typeof updateTaskStatusSchema>,
) {
	const rawTargetId = (input.id || input.taskId || "").trim();
	const numericMatch = rawTargetId.match(/^#?(\d+)$/);
	const taskNumber = numericMatch ? Number(numericMatch[1]) : null;

	const conditions = [eq(projectTasks.id, rawTargetId)];
	if (taskNumber !== null) {
		const taskNumEq = eq(projectTasks.taskNumber, taskNumber);
		if (input.projectId) {
			const projectCondition = and(
				taskNumEq,
				eq(projectTasks.projectId, input.projectId),
			);
			if (projectCondition) conditions.push(projectCondition);
		} else {
			conditions.push(taskNumEq);
		}
	}

	const [existing] = await db
		.select()
		.from(projectTasks)
		.where(or(...conditions))
		.limit(1);

	if (!existing) return { error: "Task not found." };

	const projectId = input.projectId || existing.projectId;
	const access = await assertProjectAccess(db, user, projectId, "contributor");

	if (!meetsAccessLevel(access.role, "manager")) {
		if (existing.createdById !== user.id && existing.assigneeId !== user.id) {
			return {
				error:
					"You can only change the status of tasks you own or are assigned to.",
			};
		}
	}

	if (input.status === "blocked" && !input.blockedReason?.trim()) {
		return {
			error: "A blocked reason is required when marking a task as blocked.",
		};
	}

	const isNowDone = input.status === "done";
	const wasDone = existing.status === "done";
	const completedAt = isNowDone
		? existing.completedAt || new Date()
		: wasDone
			? null
			: existing.completedAt;

	const blockedReason =
		input.status === "blocked" ? input.blockedReason?.trim() || null : null;

	await db
		.update(projectTasks)
		.set({
			status: input.status,
			completedAt,
			blockedReason,
			updatedAt: new Date(),
		})
		.where(eq(projectTasks.id, existing.id));

	await db.insert(projectEvents).values({
		id: crypto.randomUUID(),
		projectId,
		eventType: "task_status_changed",
		actorId: user.id,
		entityType: "task",
		entityId: existing.id,
		details: JSON.stringify({
			taskNumber: existing.taskNumber,
			title: existing.title,
			oldStatus: existing.status,
			newStatus: input.status,
			blockedReason,
		}),
		createdAt: new Date(),
	});

	return { success: true };
}

export const updateTaskStatus = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => updateTaskStatusSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		return updateTaskStatusCore(db, context.user, input);
	});

export const reassignTask = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => reassignTaskSchema.parse(data))
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
			.update(projectTasks)
			.set({
				assigneeId: input.newAssigneeId || null,
				updatedAt: new Date(),
			})
			.where(eq(projectTasks.id, targetId));

		await db.insert(projectEvents).values({
			id: crypto.randomUUID(),
			projectId,
			eventType: "task_reassigned",
			actorId: context.user.id,
			entityType: "task",
			entityId: targetId,
			details: JSON.stringify({
				taskNumber: existing.taskNumber,
				oldAssigneeId: existing.assigneeId,
				newAssigneeId: input.newAssigneeId,
			}),
			createdAt: new Date(),
		});

		return { success: true };
	});

export const bulkReassignTasks = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => bulkReassignTasksSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		await assertProjectAccess(db, context.user, input.projectId, "manager");

		const result = await db
			.update(projectTasks)
			.set({
				assigneeId: input.toUserId || null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(projectTasks.projectId, input.projectId),
					eq(projectTasks.assigneeId, input.fromUserId),
					ne(projectTasks.status, "done"),
					ne(projectTasks.status, "cancelled"),
				),
			)
			.returning({ id: projectTasks.id });

		await db.insert(projectEvents).values({
			id: crypto.randomUUID(),
			projectId: input.projectId,
			eventType: "tasks_bulk_reassigned",
			actorId: context.user.id,
			entityType: "member",
			details: JSON.stringify({
				fromUserId: input.fromUserId,
				toUserId: input.toUserId,
				reassignedCount: result.length,
			}),
			createdAt: new Date(),
		});

		return { success: true, count: result.length };
	});
