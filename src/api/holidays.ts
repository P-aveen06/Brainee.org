import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../db";
import { publicHolidays } from "../db/schema";
import { logAuditEvent } from "../lib/audit.server";
import { adminMiddleware, toClientError } from "../lib/server-fn";

const createHolidaySchema = z.object({
	date: z.string(),
	name: z.string().min(2, "Name must be at least 2 characters").max(100),
	description: z.string().max(500).optional().nullable(),
	year: z.number().int().min(0),
});

const updateHolidaySchema = createHolidaySchema.extend({
	id: z.string(),
});

export const createHoliday = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => createHolidaySchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const adminUser = context.user;
			const db = createDb(env.DATABASE);

			const id = crypto.randomUUID();
			await db.insert(publicHolidays).values({
				id,
				date: input.date,
				name: input.name,
				description: input.description,
				year: input.year,
			});

			const [newHoliday] = await db
				.select()
				.from(publicHolidays)
				.where(eq(publicHolidays.id, id))
				.limit(1);

			await logAuditEvent(db, {
				actorId: adminUser.id,
				action: "create",
				entityType: "public_holidays",
				entityId: id,
				newData: newHoliday,
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to create holiday.");
		}
	});

export const updateHoliday = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => updateHolidaySchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const adminUser = context.user;
			const db = createDb(env.DATABASE);

			const [oldHoliday] = await db
				.select()
				.from(publicHolidays)
				.where(eq(publicHolidays.id, input.id))
				.limit(1);

			await db
				.update(publicHolidays)
				.set({
					date: input.date,
					name: input.name,
					description: input.description,
					year: input.year,
				})
				.where(eq(publicHolidays.id, input.id));

			const [updatedHoliday] = await db
				.select()
				.from(publicHolidays)
				.where(eq(publicHolidays.id, input.id))
				.limit(1);

			await logAuditEvent(db, {
				actorId: adminUser.id,
				action: "update",
				entityType: "public_holidays",
				entityId: input.id,
				oldData: oldHoliday,
				newData: updatedHoliday,
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update holiday.");
		}
	});

export const deleteHoliday = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => z.string().parse(data))
	.handler(async ({ data: id, context }) => {
		try {
			const adminUser = context.user;
			const db = createDb(env.DATABASE);

			const [oldHoliday] = await db
				.select()
				.from(publicHolidays)
				.where(eq(publicHolidays.id, id))
				.limit(1);

			await db.delete(publicHolidays).where(eq(publicHolidays.id, id));

			await logAuditEvent(db, {
				actorId: adminUser.id,
				action: "delete",
				entityType: "public_holidays",
				entityId: id,
				oldData: oldHoliday,
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to delete holiday.");
		}
	});
