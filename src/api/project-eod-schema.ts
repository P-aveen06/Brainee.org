import { z } from "zod";

export const getEodStatusSchema = z.object({
	projectId: z.string(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
});

export const generateEodReportSchema = z.object({
	projectId: z.string(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
});

export const saveEodReportSchema = z.object({
	reportId: z.string(),
	contentFinal: z.string(),
});

export const finaliseEodReportSchema = z.object({
	reportId: z.string(),
	contentFinal: z.string().optional(),
});

export const remindMissingSchema = z.object({
	projectId: z.string(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
});
