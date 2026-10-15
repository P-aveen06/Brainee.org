import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "@/db";
import { projectComments, projectEvents, users } from "@/db/schema";
import { assertProjectAccess } from "@/lib/project-access";
import { authMiddleware, toClientError } from "@/lib/server-fn";

const getCommentsSchema = z.object({
	projectId: z.string(),
	stageKey: z.string().optional(),
	taskId: z.string().optional(),
	documentId: z.string().optional(),
});

const createCommentSchema = z.object({
	projectId: z.string(),
	stageKey: z.string().nullable().optional(),
	taskId: z.string().nullable().optional(),
	documentId: z.string().nullable().optional(),
	parentId: z.string().nullable().optional(),
	body: z.string().min(1, "Comment message cannot be empty"),
	isDecision: z.boolean().default(false),
});

export const getProjectComments = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => getCommentsSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		const access = await assertProjectAccess(
			db,
			context.user,
			input.projectId,
			"viewer",
		);

		const conditions = [eq(projectComments.projectId, input.projectId)];
		if (input.stageKey) {
			conditions.push(eq(projectComments.stageKey, input.stageKey));
		}
		if (input.taskId) {
			conditions.push(eq(projectComments.taskId, input.taskId));
		}
		if (input.documentId) {
			conditions.push(eq(projectComments.documentId, input.documentId));
		}

		const comments = await db
			.select({
				id: projectComments.id,
				projectId: projectComments.projectId,
				stageKey: projectComments.stageKey,
				taskId: projectComments.taskId,
				documentId: projectComments.documentId,
				parentId: projectComments.parentId,
				authorId: projectComments.authorId,
				authorName: users.name,
				authorEmail: users.email,
				authorAvatarUrl: users.avatarUrl,
				body: projectComments.body,
				isDecision: projectComments.isDecision,
				isPinned: projectComments.isPinned,
				editedAt: projectComments.editedAt,
				createdAt: projectComments.createdAt,
				updatedAt: projectComments.updatedAt,
			})
			.from(projectComments)
			.leftJoin(users, eq(projectComments.authorId, users.id))
			.where(and(...conditions))
			.orderBy(desc(projectComments.isPinned), asc(projectComments.createdAt));

		return { comments, access, currentUserId: context.user.id };
	});

export const createComment = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => createCommentSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			await assertProjectAccess(
				db,
				context.user,
				input.projectId,
				"contributor",
			);

			const id = crypto.randomUUID();
			await db.insert(projectComments).values({
				id,
				projectId: input.projectId,
				stageKey: input.stageKey || null,
				taskId: input.taskId || null,
				documentId: input.documentId || null,
				parentId: input.parentId || null,
				authorId: context.user.id,
				body: input.body.trim(),
				isDecision: input.isDecision,
				isPinned: false,
			});

			if (input.isDecision) {
				await db.insert(projectEvents).values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					eventType: "decision_recorded",
					actorId: context.user.id,
					entityType: "comment",
					entityId: id,
					details: JSON.stringify({
						excerpt: input.body.slice(0, 120),
						stageKey: input.stageKey,
					}),
				});
			}

			return { success: true, id };
		} catch (err) {
			return toClientError(err, "Failed to post comment.");
		}
	});

export const toggleDecisionFlag = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ commentId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const [comment] = await db
				.select()
				.from(projectComments)
				.where(eq(projectComments.id, input.commentId));

			if (!comment) return { error: "Comment not found." };
			await assertProjectAccess(
				db,
				context.user,
				comment.projectId,
				"contributor",
			);

			const nextDecision = !comment.isDecision;
			await db
				.update(projectComments)
				.set({ isDecision: nextDecision, updatedAt: new Date() })
				.where(eq(projectComments.id, input.commentId));

			return { success: true, isDecision: nextDecision };
		} catch (err) {
			return toClientError(err, "Failed to toggle decision flag.");
		}
	});

export const togglePinComment = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ commentId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const [comment] = await db
				.select()
				.from(projectComments)
				.where(eq(projectComments.id, input.commentId));

			if (!comment) return { error: "Comment not found." };
			await assertProjectAccess(db, context.user, comment.projectId, "manager");

			const nextPinned = !comment.isPinned;
			await db
				.update(projectComments)
				.set({ isPinned: nextPinned, updatedAt: new Date() })
				.where(eq(projectComments.id, input.commentId));

			return { success: true, isPinned: nextPinned };
		} catch (err) {
			return toClientError(err, "Failed to toggle pinned status.");
		}
	});

export const updateComment = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ commentId: z.string(), body: z.string().min(1) }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const [comment] = await db
				.select()
				.from(projectComments)
				.where(eq(projectComments.id, input.commentId));

			if (!comment) return { error: "Comment not found." };
			if (comment.authorId !== context.user.id) {
				return { error: "You can only edit your own comments." };
			}

			await db
				.update(projectComments)
				.set({
					body: input.body.trim(),
					editedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(projectComments.id, input.commentId));

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update comment.");
		}
	});

export const deleteComment = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ commentId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const [comment] = await db
				.select()
				.from(projectComments)
				.where(eq(projectComments.id, input.commentId));

			if (!comment) return { error: "Comment not found." };
			const access = await assertProjectAccess(
				db,
				context.user,
				comment.projectId,
				"contributor",
			);

			if (comment.authorId !== context.user.id && !access.canManage) {
				return { error: "You do not have permission to delete this comment." };
			}

			// Delete replies and comment
			await db
				.delete(projectComments)
				.where(eq(projectComments.parentId, input.commentId));
			await db
				.delete(projectComments)
				.where(eq(projectComments.id, input.commentId));

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to delete comment.");
		}
	});
