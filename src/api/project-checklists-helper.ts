import { and, asc, eq } from "@/db/graph-query";
import { z } from "zod";
import type { createDb } from "@/db";
import { projectChecklistItems, projectChecklistTemplates } from "@/db/schema";

export const getChecklistSchema = z.object({
	projectId: z.string(),
	stageKey: z.string().optional(),
});

export const toggleChecklistSchema = z.object({
	itemId: z.string(),
	status: z.enum(["pending", "done", "not_applicable"]),
	notes: z.string().optional(),
});

export const createItemSchema = z.object({
	projectId: z.string(),
	stageKey: z.string(),
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	isRequired: z.boolean().default(false),
	assignedToId: z.string().nullable().optional(),
	dueDate: z.string().nullable().optional(),
});

export const updateItemSchema = z.object({
	itemId: z.string(),
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	isRequired: z.boolean().optional(),
	assignedToId: z.string().nullable().optional(),
	dueDate: z.string().nullable().optional(),
	notes: z.string().optional(),
});

/**
 * Instantiates template items for a stage if none exist for this project+stage.
 */
export async function ensureStageChecklistInstantiated(
	db: ReturnType<typeof createDb>,
	projectId: string,
	stageKey: string,
) {
	const existing = await db
		.select({ id: projectChecklistItems.id })
		.from(projectChecklistItems)
		.where(
			and(
				eq(projectChecklistItems.projectId, projectId),
				eq(projectChecklistItems.stageKey, stageKey),
			),
		)
		.limit(1);

	if (existing.length > 0) return;

	const templates = await db
		.select()
		.from(projectChecklistTemplates)
		.where(
			and(
				eq(projectChecklistTemplates.stageKey, stageKey),
				eq(projectChecklistTemplates.isActive, true),
			),
		)
		.orderBy(asc(projectChecklistTemplates.sequence));

	if (templates.length === 0) return;

	for (const t of templates) {
		await db.insert(projectChecklistItems).values({
			id: crypto.randomUUID(),
			projectId,
			stageKey,
			templateId: t.id,
			title: t.title,
			description: t.description,
			isRequired: t.isRequired,
			status: "pending",
			sequence: t.sequence,
		});
	}
}
