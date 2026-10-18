import { createServerFn } from "@tanstack/react-start";
import { count, eq } from "@/db/graph-query";
import { z } from "zod";
import { createDb } from "../db";
import {
	leaveBalances,
	leaveRequests,
	systemLeaveTypes,
	users,
} from "../db/schema";
import { logAuditEvent } from "../lib/audit.server";
import {
	getCompletedServiceYears,
	getLeaveCycleBounds,
} from "../lib/leave-policy";
import { AppError, adminMiddleware, toClientError } from "../lib/server-fn";

const createLeaveTypeSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters").max(100),
	slug: z.string().min(2).max(100),
	description: z.string().max(500).optional().nullable(),
	defaultDays: z.number().min(0),
	accrualPerYear: z.number().min(0).optional().nullable(),
	applyBeforeDays: z.number().min(0).optional().nullable(),
	applyBeforeDaysExtended: z.number().min(0).optional().nullable(),
	extendedLimitTrigger: z.number().min(0).optional().nullable(),
	assignToAll: z.boolean().optional(),
	assignedUserIds: z.array(z.string()).optional(),
});

const updateLeaveTypeSchema = createLeaveTypeSchema
	.omit({ assignToAll: true, assignedUserIds: true })
	.extend({
		id: z.string(),
	});

function translateUniqueSlugError(err: unknown) {
	if (
		err instanceof Error &&
		err.message.includes("UNIQUE constraint failed") &&
		err.message.includes("slug")
	) {
		return new AppError("A leave type with this slug already exists.");
	}
	return err;
}

export const createLeaveType = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => createLeaveTypeSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const adminUser = context.user;
			const db = createDb();

			const id = crypto.randomUUID();
			const accrualPerYear = input.accrualPerYear ?? 0;
			await db.insert(systemLeaveTypes).values({
				id,
				name: input.name,
				slug: input.slug,
				description: input.description,
				defaultDays: input.defaultDays,
				accrualPerYear,
				applyBeforeDays: input.applyBeforeDays ?? 0,
				applyBeforeDaysExtended: input.applyBeforeDaysExtended ?? 0,
				extendedLimitTrigger: input.extendedLimitTrigger ?? 0,
			});

			const [newLeaveType] = await db
				.select()
				.from(systemLeaveTypes)
				.where(eq(systemLeaveTypes.id, id))
				.limit(1);

			const dbUsers = await db
				.select()
				.from(users)
				.where(eq(users.isActive, true));
			const targetUserIds = input.assignToAll
				? new Set(dbUsers.map((user) => user.id))
				: new Set(input.assignedUserIds ?? []);
			const targetUsers = dbUsers.filter(
				(user) => targetUserIds.has(user.id) && user.birthday,
			);

			if (targetUsers.length > 0) {
				await db
					.insert(leaveBalances)
					.values(
						targetUsers.map((user) => {
							const cycle = getLeaveCycleBounds(user.birthday as string);
							return {
								id: crypto.randomUUID(),
								userId: user.id,
								leaveType: input.slug,
								totalLimit:
									input.defaultDays +
									accrualPerYear *
										getCompletedServiceYears(user.joinDate, cycle.cycleStart),
								used: 0,
								cycleStart: cycle.cycleStart,
								cycleEnd: cycle.cycleEnd,
								updatedAt: new Date(),
							};
						}),
					)
					.onConflictDoNothing({
						target: [
							leaveBalances.userId,
							leaveBalances.leaveType,
							leaveBalances.cycleStart,
						],
					});
			}

			await logAuditEvent(db, {
				actorId: adminUser.id,
				action: "create",
				entityType: "system_leave_types",
				entityId: id,
				newData: newLeaveType,
			});

			return { success: true, data: newLeaveType };
		} catch (err) {
			return toClientError(
				translateUniqueSlugError(err),
				"Failed to create leave type.",
			);
		}
	});

export const updateLeaveType = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => updateLeaveTypeSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const adminUser = context.user;
			const db = createDb();

			const [oldLeaveType] = await db
				.select()
				.from(systemLeaveTypes)
				.where(eq(systemLeaveTypes.id, input.id))
				.limit(1);

			if (!oldLeaveType) {
				return { error: "Leave type not found." };
			}

			// Balances and requests reference the type by slug, so a slug change
			// must be cascaded atomically to keep them attached.
			if (oldLeaveType.slug !== input.slug) {
				await db.batch([
					db
						.update(systemLeaveTypes)
						.set({
							name: input.name,
							slug: input.slug,
							description: input.description,
							defaultDays: input.defaultDays,
							accrualPerYear: input.accrualPerYear ?? 0,
							applyBeforeDays: input.applyBeforeDays ?? 0,
							applyBeforeDaysExtended: input.applyBeforeDaysExtended ?? 0,
							extendedLimitTrigger: input.extendedLimitTrigger ?? 0,
						})
						.where(eq(systemLeaveTypes.id, input.id)),
					db
						.update(leaveBalances)
						.set({ leaveType: input.slug })
						.where(eq(leaveBalances.leaveType, oldLeaveType.slug)),
					db
						.update(leaveRequests)
						.set({ leaveType: input.slug })
						.where(eq(leaveRequests.leaveType, oldLeaveType.slug)),
				]);
			} else {
				await db
					.update(systemLeaveTypes)
					.set({
						name: input.name,
						slug: input.slug,
						description: input.description,
						defaultDays: input.defaultDays,
						accrualPerYear: input.accrualPerYear ?? 0,
						applyBeforeDays: input.applyBeforeDays ?? 0,
						applyBeforeDaysExtended: input.applyBeforeDaysExtended ?? 0,
						extendedLimitTrigger: input.extendedLimitTrigger ?? 0,
					})
					.where(eq(systemLeaveTypes.id, input.id));
			}

			const [updatedLeaveType] = await db
				.select()
				.from(systemLeaveTypes)
				.where(eq(systemLeaveTypes.id, input.id))
				.limit(1);

			await logAuditEvent(db, {
				actorId: adminUser.id,
				action: "update",
				entityType: "system_leave_types",
				entityId: input.id,
				oldData: oldLeaveType,
				newData: updatedLeaveType,
			});

			return { success: true, data: updatedLeaveType };
		} catch (err) {
			return toClientError(
				translateUniqueSlugError(err),
				"Failed to update leave type.",
			);
		}
	});

export const deleteLeaveType = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => z.string().parse(data))
	.handler(async ({ data: id, context }) => {
		try {
			const adminUser = context.user;
			const db = createDb();

			const [oldLeaveType] = await db
				.select()
				.from(systemLeaveTypes)
				.where(eq(systemLeaveTypes.id, id))
				.limit(1);

			if (!oldLeaveType) {
				return { error: "Leave type not found." };
			}

			// Deleting a type that balances or requests still reference would
			// orphan that data (the link is the slug, not a foreign key).
			const [balanceRefs] = await db
				.select({ count: count() })
				.from(leaveBalances)
				.where(eq(leaveBalances.leaveType, oldLeaveType.slug));
			const [requestRefs] = await db
				.select({ count: count() })
				.from(leaveRequests)
				.where(eq(leaveRequests.leaveType, oldLeaveType.slug));

			if ((balanceRefs?.count ?? 0) > 0 || (requestRefs?.count ?? 0) > 0) {
				return {
					error:
						"This leave type is in use by existing balances or requests and cannot be deleted.",
				};
			}

			await db.delete(systemLeaveTypes).where(eq(systemLeaveTypes.id, id));

			await logAuditEvent(db, {
				actorId: adminUser.id,
				action: "delete",
				entityType: "system_leave_types",
				entityId: id,
				oldData: oldLeaveType,
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to delete leave type.");
		}
	});
