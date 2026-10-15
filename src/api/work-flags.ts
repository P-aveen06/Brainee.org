import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../db";
import { users, workFlags } from "../db/schema";
import { assertProjectAccess, meetsAccessLevel } from "../lib/project-access";
import { authMiddleware } from "../lib/server-fn";

export * from "./work-flags-scan";

// ─── Input Schemas ───

const getWorkFlagsSchema = z.object({
	projectId: z.string(),
	status: z.enum(["open", "acknowledged", "dismissed", "all"]).default("open"),
});

const acknowledgeFlagSchema = z.object({
	flagId: z.string(),
});

const dismissFlagSchema = z.object({
	flagId: z.string(),
});

// ─── Server Functions ───

export const getWorkFlags = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => getWorkFlagsSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		const access = await assertProjectAccess(
			db,
			context.user,
			input.projectId,
			"viewer",
		);

		const isManager = meetsAccessLevel(access.role, "manager");

		// Visibility rule: shown to managers OR the person the flag concerns
		const visCondition = isManager
			? undefined
			: or(
					eq(workFlags.raisedForUserId, context.user.id),
					sql`${workFlags.raisedForUserId} IS NULL`,
				);

		// Filter conditions
		const conditions = [eq(workFlags.projectId, input.projectId)];

		if (input.status !== "all") {
			conditions.push(eq(workFlags.status, input.status));
		}

		if (visCondition) {
			conditions.push(visCondition);
		}

		const flags = await db
			.select({
				id: workFlags.id,
				projectId: workFlags.projectId,
				entityType: workFlags.entityType,
				entityId: workFlags.entityId,
				flagCode: workFlags.flagCode,
				severity: workFlags.severity,
				message: workFlags.message,
				evidence: workFlags.evidence,
				source: workFlags.source,
				status: workFlags.status,
				raisedForUserId: workFlags.raisedForUserId,
				raisedForUserName: users.name,
				resolvedById: workFlags.resolvedById,
				createdAt: workFlags.createdAt,
				updatedAt: workFlags.updatedAt,
			})
			.from(workFlags)
			.leftJoin(users, eq(workFlags.raisedForUserId, users.id))
			.where(and(...conditions))
			.orderBy(desc(workFlags.createdAt));

		// Count open flags for quick badge, honoring the same visibility rule as the list above
		const openCountConditions = [
			eq(workFlags.projectId, input.projectId),
			eq(workFlags.status, "open"),
		];
		if (visCondition) {
			openCountConditions.push(visCondition);
		}

		const [openCountRow] = await db
			.select({ count: sql<number>`count(*)` })
			.from(workFlags)
			.where(and(...openCountConditions));

		return {
			flags,
			openCount: Number(openCountRow?.count || 0),
			access,
			isManager,
		};
	});

export const acknowledgeWorkFlag = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => acknowledgeFlagSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);

		const [flag] = await db
			.select()
			.from(workFlags)
			.where(eq(workFlags.id, input.flagId))
			.limit(1);

		if (!flag) return { error: "Work flag not found." };
		const access = await assertProjectAccess(
			db,
			context.user,
			flag.projectId,
			"contributor",
		);

		const isManager = meetsAccessLevel(access.role, "manager");
		const isTarget = flag.raisedForUserId === context.user.id;

		if (!isManager && !isTarget) {
			return {
				error:
					"You can only acknowledge flags assigned to you or as a manager.",
			};
		}

		await db
			.update(workFlags)
			.set({
				status: "acknowledged",
				updatedAt: new Date(),
			})
			.where(eq(workFlags.id, input.flagId));

		return { success: true };
	});

export const dismissWorkFlag = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => dismissFlagSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);

		const [flag] = await db
			.select()
			.from(workFlags)
			.where(eq(workFlags.id, input.flagId))
			.limit(1);

		if (!flag) return { error: "Work flag not found." };
		const access = await assertProjectAccess(
			db,
			context.user,
			flag.projectId,
			"contributor",
		);

		const isManager = meetsAccessLevel(access.role, "manager");
		const isTarget = flag.raisedForUserId === context.user.id;

		if (!isManager && !isTarget) {
			return {
				error: "You can only dismiss flags assigned to you or as a manager.",
			};
		}

		await db
			.update(workFlags)
			.set({
				status: "dismissed",
				resolvedById: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(workFlags.id, input.flagId));

		return { success: true };
	});
