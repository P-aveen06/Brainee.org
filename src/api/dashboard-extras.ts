import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../db";
import { dashboardLayouts } from "../db/schema";
import { getCalendarEvents } from "../lib/dashboard-calendar.server";
import { getDashboardExtras } from "../lib/dashboard-extras.server";
import { isWidgetId } from "../lib/dashboard-layout";
import { authMiddleware } from "../lib/server-fn";

export const loadDashboardExtras = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => getDashboardExtras(context.user));

export const getDashboardCalendar = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z
			.string()
			.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
			.parse(data),
	)
	.handler(async ({ data: month }) => ({
		month,
		events: await getCalendarEvents(month),
	}));

const layoutSchema = z
	.array(
		z.object({
			id: z.string().refine(isWidgetId, "Unknown widget"),
			hidden: z.boolean(),
			size: z.enum(["sm", "md", "lg"]).optional(),
		}),
	)
	.max(20);

export const saveDashboardLayout = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => layoutSchema.parse(data))
	.handler(async ({ data, context }) => {
		const db = createDb(env.DATABASE);
		const layout = JSON.stringify(data);
		await db
			.insert(dashboardLayouts)
			.values({ userId: context.user.id, layout })
			.onConflictDoUpdate({
				target: dashboardLayouts.userId,
				set: { layout, updatedAt: new Date() },
			});
		return { ok: true as const };
	});

export const resetDashboardLayout = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const db = createDb(env.DATABASE);
		await db
			.delete(dashboardLayouts)
			.where(eq(dashboardLayouts.userId, context.user.id));
		return { ok: true as const };
	});
