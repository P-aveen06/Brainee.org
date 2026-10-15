import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "@/db";
import { projectChecklistTemplates } from "@/db/schema";
import {
	adminMiddleware,
	authMiddleware,
	toClientError,
} from "@/lib/server-fn";

const templateSchema = z.object({
	id: z.string().optional(),
	stageKey: z.string(),
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	isRequired: z.boolean().default(false),
	sequence: z.number().int().default(0),
});

export const getChecklistTemplates = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async () => {
		const db = createDb(env.DATABASE);
		const templates = await db
			.select()
			.from(projectChecklistTemplates)
			.where(eq(projectChecklistTemplates.isActive, true))
			.orderBy(
				asc(projectChecklistTemplates.stageKey),
				asc(projectChecklistTemplates.sequence),
			);
		return { templates };
	});

export const upsertChecklistTemplate = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => templateSchema.parse(data))
	.handler(async ({ data: input }) => {
		try {
			const db = createDb(env.DATABASE);
			if (input.id) {
				await db
					.update(projectChecklistTemplates)
					.set({
						title: input.title,
						description: input.description,
						isRequired: input.isRequired,
						sequence: input.sequence,
						updatedAt: new Date(),
					})
					.where(eq(projectChecklistTemplates.id, input.id));
			} else {
				await db.insert(projectChecklistTemplates).values({
					id: crypto.randomUUID(),
					stageKey: input.stageKey,
					title: input.title,
					description: input.description,
					isRequired: input.isRequired,
					sequence: input.sequence,
				});
			}
			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to save checklist template.");
		}
	});

export const deleteChecklistTemplate = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
	.handler(async ({ data: input }) => {
		try {
			const db = createDb(env.DATABASE);
			await db
				.update(projectChecklistTemplates)
				.set({ isActive: false, updatedAt: new Date() })
				.where(eq(projectChecklistTemplates.id, input.id));
			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to delete checklist template.");
		}
	});
