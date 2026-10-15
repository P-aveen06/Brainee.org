import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../db";
import { projectTasks, workFlags } from "../db/schema";
import { getTodayIsoDate } from "../lib/leave-policy";
import { assertProjectAccess } from "../lib/project-access";
import { authMiddleware } from "../lib/server-fn";
import {
	checkEstimateExceeded,
	checkStalledTask,
} from "../lib/work-flag-rules";

const scanFlagsSchema = z.object({
	projectId: z.string(),
});

export const scanProjectWorkFlags = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => scanFlagsSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		await assertProjectAccess(db, context.user, input.projectId, "contributor");

		const today = getTodayIsoDate();

		const tasks = await db
			.select({
				id: projectTasks.id,
				taskNumber: projectTasks.taskNumber,
				title: projectTasks.title,
				status: projectTasks.status,
				assigneeId: projectTasks.assigneeId,
				estimateHours: projectTasks.estimateHours,
				actualHours: projectTasks.actualHours,
				updatedAt: projectTasks.updatedAt,
			})
			.from(projectTasks)
			.where(
				and(
					eq(projectTasks.projectId, input.projectId),
					sql`${projectTasks.status} != 'done'`,
					sql`${projectTasks.status} != 'cancelled'`,
				),
			);

		let generatedCount = 0;

		for (const task of tasks) {
			const lastUpdatedIso = task.updatedAt
				? getTodayIsoDate(task.updatedAt)
				: null;
			const stalledEval = checkStalledTask({
				status: task.status,
				lastReferencedDate: lastUpdatedIso,
				today,
				thresholdDays: 3,
			});

			if (stalledEval) {
				const [existing] = await db
					.select({ id: workFlags.id })
					.from(workFlags)
					.where(
						and(
							eq(workFlags.projectId, input.projectId),
							eq(workFlags.entityType, "task"),
							eq(workFlags.entityId, task.id),
							eq(workFlags.flagCode, stalledEval.flagCode),
							eq(workFlags.status, "open"),
						),
					)
					.limit(1);

				if (!existing) {
					await db.insert(workFlags).values({
						id: crypto.randomUUID(),
						projectId: input.projectId,
						entityType: "task",
						entityId: task.id,
						flagCode: stalledEval.flagCode,
						severity: stalledEval.severity,
						message: `Task #${task.taskNumber} (${task.title}): ${stalledEval.message}`,
						evidence: stalledEval.evidence
							? JSON.stringify(stalledEval.evidence)
							: null,
						source: "rule",
						status: "open",
						raisedForUserId: task.assigneeId,
						createdAt: new Date(),
						updatedAt: new Date(),
					});
					generatedCount++;
				}
			}

			const estimateEval = checkEstimateExceeded({
				estimateHours: task.estimateHours,
				actualHours: task.actualHours,
				thresholdMultiplier: 1.25,
			});

			if (estimateEval) {
				const [existing] = await db
					.select({ id: workFlags.id })
					.from(workFlags)
					.where(
						and(
							eq(workFlags.projectId, input.projectId),
							eq(workFlags.entityType, "task"),
							eq(workFlags.entityId, task.id),
							eq(workFlags.flagCode, estimateEval.flagCode),
							eq(workFlags.status, "open"),
						),
					)
					.limit(1);

				if (!existing) {
					await db.insert(workFlags).values({
						id: crypto.randomUUID(),
						projectId: input.projectId,
						entityType: "task",
						entityId: task.id,
						flagCode: estimateEval.flagCode,
						severity: estimateEval.severity,
						message: `Task #${task.taskNumber} (${task.title}): ${estimateEval.message}`,
						evidence: estimateEval.evidence
							? JSON.stringify(estimateEval.evidence)
							: null,
						source: "rule",
						status: "open",
						raisedForUserId: task.assigneeId,
						createdAt: new Date(),
						updatedAt: new Date(),
					});
					generatedCount++;
				}
			}
		}

		return { success: true, generatedCount };
	});
