import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../db";
import { notifications } from "../db/schema";
import { authMiddleware } from "../lib/server-fn";

export const markNotificationRead = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((id: unknown) => {
		return z.string().parse(id);
	})
	.handler(async ({ data: id, context }) => {
		const user = context.user;
		const db = createDb(env.DATABASE);
		await db
			.update(notifications)
			.set({ isRead: true })
			.where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));

		return { success: true };
	});

export const markAllNotificationsRead = createServerFn({
	method: "POST",
})
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const user = context.user;
		const db = createDb(env.DATABASE);
		await db
			.update(notifications)
			.set({ isRead: true })
			.where(
				and(eq(notifications.userId, user.id), eq(notifications.isRead, false)),
			);

		return { success: true };
	});
