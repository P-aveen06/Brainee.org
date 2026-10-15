import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, sql } from "drizzle-orm";
import { createDb } from "../db";
import {
	projectDailyUpdateItems,
	projectDailyUpdates,
	projectTasks,
	workFlags,
} from "../db/schema";
import {
	extractTasksWithAi,
	generateAndCreateTaskFromSummary,
	persistConfirmedTask,
} from "../lib/ai/ai-task-generator.server";
import { getTodayIsoDate } from "../lib/leave-policy";
import { assertProjectAccess } from "../lib/project-access";
import { authMiddleware } from "../lib/server-fn";
import { checkNoTaskLinked } from "../lib/work-flag-rules";
import {
	confirmAiTaskSchema,
	confirmMultipleAiTasksSchema,
	generateTaskFromSummarySchema,
	getMyUpdateSchema,
	previewTaskFromSummarySchema,
	saveDailyUpdateSchema,
} from "./project-daily-updates-schema";

export * from "./project-daily-updates-schema";
export * from "./project-daily-updates-team";

export const previewTaskFromDailySummary = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => previewTaskFromSummarySchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		await assertProjectAccess(db, context.user, input.projectId, "contributor");

		const tasks = await extractTasksWithAi(input.summary, input.blockers);
		return {
			success: true,
			tasks,
		};
	});

export const confirmAndCreateAiTask = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => confirmAiTaskSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		await assertProjectAccess(db, context.user, input.projectId, "contributor");

		const created = await persistConfirmedTask(db, context.user, {
			projectId: input.projectId,
			title: input.title,
			status: input.status,
			description: input.description,
			date: input.date || getTodayIsoDate(),
			hoursSpent: input.hoursSpent,
		});

		return {
			success: true,
			task: created,
		};
	});

export const confirmMultipleAiTasks = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => confirmMultipleAiTasksSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		await assertProjectAccess(db, context.user, input.projectId, "contributor");

		const createdTasks = [];
		for (const item of input.tasks) {
			const created = await persistConfirmedTask(db, context.user, {
				projectId: input.projectId,
				title: item.title,
				status: item.status,
				description: item.description,
				date: input.date || getTodayIsoDate(),
			});
			createdTasks.push(created);
		}

		return {
			success: true,
			tasks: createdTasks,
		};
	});

export const generateTaskFromDailySummary = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => generateTaskFromSummarySchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		await assertProjectAccess(db, context.user, input.projectId, "contributor");

		const targetDate = input.date || getTodayIsoDate();

		const generated = await generateAndCreateTaskFromSummary(db, context.user, {
			projectId: input.projectId,
			summary: input.summary,
			blockers: input.blockers,
			date: targetDate,
			hoursSpent: input.hoursSpent,
		});

		return {
			success: true,
			task: generated,
		};
	});

export const getMyDailyUpdate = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => getMyUpdateSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		await assertProjectAccess(db, context.user, input.projectId, "contributor");

		const targetDate = input.date || getTodayIsoDate();

		const [update] = await db
			.select()
			.from(projectDailyUpdates)
			.where(
				and(
					eq(projectDailyUpdates.projectId, input.projectId),
					eq(projectDailyUpdates.userId, context.user.id),
					eq(projectDailyUpdates.date, targetDate),
				),
			)
			.limit(1);

		let items: Array<{
			id: string;
			taskId: string;
			taskNumber: number;
			taskTitle: string;
			taskStatus: string;
			note: string | null;
			progressNote: string | null;
		}> = [];

		if (update) {
			const rawItems = await db
				.select({
					id: projectDailyUpdateItems.id,
					taskId: projectDailyUpdateItems.taskId,
					taskNumber: projectTasks.taskNumber,
					taskTitle: projectTasks.title,
					taskStatus: projectTasks.status,
					note: projectDailyUpdateItems.note,
					progressNote: projectDailyUpdateItems.progressNote,
				})
				.from(projectDailyUpdateItems)
				.leftJoin(
					projectTasks,
					eq(projectDailyUpdateItems.taskId, projectTasks.id),
				)
				.where(eq(projectDailyUpdateItems.updateId, update.id));

			items = rawItems.map((r) => ({
				...r,
				taskNumber: r.taskNumber || 0,
				taskTitle: r.taskTitle || "Task",
				taskStatus: r.taskStatus || "todo",
			}));
		}

		const myOpenTasks = await db
			.select({
				id: projectTasks.id,
				taskNumber: projectTasks.taskNumber,
				title: projectTasks.title,
				status: projectTasks.status,
			})
			.from(projectTasks)
			.where(
				and(
					eq(projectTasks.projectId, input.projectId),
					eq(projectTasks.assigneeId, context.user.id),
					sql`${projectTasks.status} != 'cancelled'`,
				),
			)
			.orderBy(desc(projectTasks.updatedAt));

		return {
			update: update || null,
			items,
			myOpenTasks,
			date: targetDate,
			today: getTodayIsoDate(),
		};
	});

export const saveDailyUpdate = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => saveDailyUpdateSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		await assertProjectAccess(db, context.user, input.projectId, "contributor");

		const isSubmitting = input.status === "submitted";
		const updateId = crypto.randomUUID();

		const [existing] = await db
			.select({ id: projectDailyUpdates.id })
			.from(projectDailyUpdates)
			.where(
				and(
					eq(projectDailyUpdates.projectId, input.projectId),
					eq(projectDailyUpdates.userId, context.user.id),
					eq(projectDailyUpdates.date, input.date),
				),
			)
			.limit(1);

		let activeUpdateId = existing?.id;

		if (existing) {
			await db
				.update(projectDailyUpdates)
				.set({
					summary: input.summary.trim(),
					blockers: input.blockers?.trim() || null,
					hoursSpent: input.hoursSpent ?? null,
					status: input.status,
					submittedAt: isSubmitting ? new Date() : undefined,
					updatedAt: new Date(),
				})
				.where(eq(projectDailyUpdates.id, existing.id));
		} else {
			activeUpdateId = updateId;
			await db.insert(projectDailyUpdates).values({
				id: updateId,
				projectId: input.projectId,
				userId: context.user.id,
				date: input.date,
				summary: input.summary.trim(),
				blockers: input.blockers?.trim() || null,
				hoursSpent: input.hoursSpent ?? null,
				status: input.status,
				submittedAt: isSubmitting ? new Date() : null,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		if (activeUpdateId) {
			await db
				.delete(projectDailyUpdateItems)
				.where(eq(projectDailyUpdateItems.updateId, activeUpdateId));

			let linkedItems = input.items || [];

			// If submitting without linked tasks and autoCreateTask is not explicitly false, auto-generate with AI
			const shouldAutoCreate =
				isSubmitting &&
				linkedItems.length === 0 &&
				input.autoCreateTask !== false &&
				input.summary.trim().length > 0;

			if (shouldAutoCreate) {
				try {
					const generated = await generateAndCreateTaskFromSummary(
						db,
						context.user,
						{
							projectId: input.projectId,
							summary: input.summary,
							blockers: input.blockers,
							date: input.date,
							hoursSpent: input.hoursSpent,
						},
					);
					linkedItems = [
						{
							taskId: generated.id,
							note: input.summary.trim(),
							progressNote: null,
						},
					];
				} catch (err) {
					console.warn(
						"Failed to auto-generate task on daily update submission:",
						err,
					);
				}
			}

			if (linkedItems.length > 0) {
				for (const item of linkedItems) {
					await db.insert(projectDailyUpdateItems).values({
						id: crypto.randomUUID(),
						updateId: activeUpdateId,
						taskId: item.taskId,
						note: item.note?.trim() || null,
						progressNote: item.progressNote?.trim() || null,
						createdAt: new Date(),
					});
				}
			}

			if (isSubmitting) {
				const flagEval = checkNoTaskLinked({
					status: "submitted",
					itemCount: linkedItems.length,
				});

				if (flagEval) {
					const [existingFlag] = await db
						.select({ id: workFlags.id })
						.from(workFlags)
						.where(
							and(
								eq(workFlags.projectId, input.projectId),
								eq(workFlags.entityType, "daily_update"),
								eq(workFlags.entityId, activeUpdateId),
								eq(workFlags.flagCode, flagEval.flagCode),
								eq(workFlags.status, "open"),
							),
						)
						.limit(1);

					if (!existingFlag) {
						await db.insert(workFlags).values({
							id: crypto.randomUUID(),
							projectId: input.projectId,
							entityType: "daily_update",
							entityId: activeUpdateId,
							flagCode: flagEval.flagCode,
							severity: flagEval.severity,
							message: flagEval.message,
							evidence: flagEval.evidence
								? JSON.stringify(flagEval.evidence)
								: null,
							source: "rule",
							status: "open",
							raisedForUserId: context.user.id,
							createdAt: new Date(),
							updatedAt: new Date(),
						});
					}
				}
			}
		}

		return {
			success: true,
			updateId: activeUpdateId,
			status: input.status,
		};
	});
