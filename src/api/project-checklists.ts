import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "@/db/graph-query";
import { z } from "zod";
import { createDb } from "@/db";
import {
	projectChecklistItems,
	projectEvents,
	projectStages,
	users,
} from "@/db/schema";
import { assertProjectAccess } from "@/lib/project-access";
import { authMiddleware, toClientError } from "@/lib/server-fn";
import {
	createItemSchema,
	ensureStageChecklistInstantiated,
	getChecklistSchema,
	toggleChecklistSchema,
	updateItemSchema,
} from "./project-checklists-helper";

export {
	deleteChecklistTemplate,
	getChecklistTemplates,
	upsertChecklistTemplate,
} from "./project-checklist-templates";

export const getProjectChecklist = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => getChecklistSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		const access = await assertProjectAccess(
			db,
			context.user,
			input.projectId,
			"viewer",
		);

		const stages = await db
			.select()
			.from(projectStages)
			.where(eq(projectStages.isActive, true))
			.orderBy(asc(projectStages.sequence));

		for (const s of stages) {
			await ensureStageChecklistInstantiated(db, input.projectId, s.key);
		}

		const items = await db
			.select({
				id: projectChecklistItems.id,
				projectId: projectChecklistItems.projectId,
				stageKey: projectChecklistItems.stageKey,
				templateId: projectChecklistItems.templateId,
				title: projectChecklistItems.title,
				description: projectChecklistItems.description,
				isRequired: projectChecklistItems.isRequired,
				status: projectChecklistItems.status,
				assignedToId: projectChecklistItems.assignedToId,
				assignedToName: users.name,
				assignedToAvatar: users.avatarUrl,
				dueDate: projectChecklistItems.dueDate,
				completedById: projectChecklistItems.completedById,
				completedAt: projectChecklistItems.completedAt,
				notes: projectChecklistItems.notes,
				sequence: projectChecklistItems.sequence,
			})
			.from(projectChecklistItems)
			.leftJoin(users, eq(projectChecklistItems.assignedToId, users.id))
			.where(eq(projectChecklistItems.projectId, input.projectId))
			.orderBy(
				asc(projectChecklistItems.stageKey),
				asc(projectChecklistItems.sequence),
			);

		return { items, access };
	});

export const toggleChecklistItem = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => toggleChecklistSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();

			const [item] = await db
				.select()
				.from(projectChecklistItems)
				.where(eq(projectChecklistItems.id, input.itemId));

			if (!item) {
				return { error: "Checklist item not found." };
			}

			const access = await assertProjectAccess(
				db,
				context.user,
				item.projectId,
				"contributor",
			);

			const isAssignedToSelf = item.assignedToId === context.user.id;
			const isOwnItem = item.createdById === context.user.id;
			if (!access.canManage && !isAssignedToSelf && !isOwnItem) {
				return {
					error:
						"You can only tick checklist items assigned to you or that you created.",
				};
			}

			const isDone = input.status === "done";
			await db
				.update(projectChecklistItems)
				.set({
					status: input.status,
					completedById: isDone ? context.user.id : null,
					completedAt: isDone ? new Date() : null,
					notes: input.notes !== undefined ? input.notes : item.notes,
					updatedAt: new Date(),
				})
				.where(eq(projectChecklistItems.id, input.itemId));

			await db.insert(projectEvents).values({
				id: crypto.randomUUID(),
				projectId: item.projectId,
				eventType: isDone ? "checklist_completed" : "checklist_updated",
				actorId: context.user.id,
				entityType: "checklist_item",
				entityId: item.id,
				details: JSON.stringify({
					title: item.title,
					status: input.status,
					stageKey: item.stageKey,
				}),
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update checklist item.");
		}
	});

export const createChecklistItem = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => createItemSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			await assertProjectAccess(
				db,
				context.user,
				input.projectId,
				"contributor",
			);

			const id = crypto.randomUUID();
			await db.insert(projectChecklistItems).values({
				id,
				projectId: input.projectId,
				stageKey: input.stageKey,
				title: input.title,
				description: input.description,
				isRequired: input.isRequired,
				status: "pending",
				assignedToId: input.assignedToId || null,
				createdById: context.user.id,
				dueDate: input.dueDate || null,
			});

			return { success: true, id };
		} catch (err) {
			return toClientError(err, "Failed to create checklist item.");
		}
	});

export const updateChecklistItem = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => updateItemSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const [item] = await db
				.select()
				.from(projectChecklistItems)
				.where(eq(projectChecklistItems.id, input.itemId));

			if (!item) return { error: "Item not found." };
			await assertProjectAccess(
				db,
				context.user,
				item.projectId,
				"contributor",
			);

			await db
				.update(projectChecklistItems)
				.set({
					title: input.title ?? item.title,
					description: input.description ?? item.description,
					isRequired: input.isRequired ?? item.isRequired,
					assignedToId:
						input.assignedToId !== undefined
							? input.assignedToId
							: item.assignedToId,
					dueDate: input.dueDate !== undefined ? input.dueDate : item.dueDate,
					notes: input.notes !== undefined ? input.notes : item.notes,
					updatedAt: new Date(),
				})
				.where(eq(projectChecklistItems.id, input.itemId));

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update checklist item.");
		}
	});

export const deleteChecklistItem = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ itemId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const [item] = await db
				.select()
				.from(projectChecklistItems)
				.where(eq(projectChecklistItems.id, input.itemId));

			if (!item) return { error: "Item not found." };
			await assertProjectAccess(db, context.user, item.projectId, "manager");

			await db
				.delete(projectChecklistItems)
				.where(eq(projectChecklistItems.id, input.itemId));
			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to delete checklist item.");
		}
	});
