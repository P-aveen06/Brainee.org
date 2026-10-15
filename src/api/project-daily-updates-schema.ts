import { z } from "zod";

export const getMyUpdateSchema = z.object({
	projectId: z.string(),
	date: z.string().optional(),
});

export const saveDailyUpdateSchema = z.object({
	projectId: z.string(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
	summary: z.string().min(1, "Summary is required"),
	blockers: z.string().optional().nullable(),
	hoursSpent: z.number().min(0).max(24).optional().nullable(),
	status: z.enum(["draft", "submitted"]).default("draft"),
	items: z
		.array(
			z.object({
				taskId: z.string(),
				note: z.string().optional().nullable(),
				progressNote: z.string().optional().nullable(),
			}),
		)
		.optional(),
	autoCreateTask: z.boolean().optional(),
});

export const generateTaskFromSummarySchema = z.object({
	projectId: z.string(),
	summary: z.string().min(1, "Summary is required"),
	blockers: z.string().optional().nullable(),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
		.optional(),
	hoursSpent: z.number().min(0).max(24).optional().nullable(),
});

export const previewTaskFromSummarySchema = z.object({
	projectId: z.string(),
	summary: z.string().min(1, "Summary is required"),
	blockers: z.string().optional().nullable(),
});

export const confirmAiTaskSchema = z.object({
	projectId: z.string(),
	title: z.string().min(1, "Task title is required"),
	status: z.enum(["todo", "in_progress", "done", "blocked"]).default("done"),
	description: z.string().optional().nullable(),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
		.optional(),
	hoursSpent: z.number().min(0).max(24).optional().nullable(),
});

export const confirmMultipleAiTasksSchema = z.object({
	projectId: z.string(),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
		.optional(),
	tasks: z.array(
		z.object({
			title: z.string().min(1, "Task title is required"),
			status: z
				.enum(["todo", "in_progress", "done", "blocked"])
				.default("done"),
			description: z.string().optional().nullable(),
		}),
	),
});

export const getProjectDailyUpdatesSchema = z.object({
	projectId: z.string(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
});
