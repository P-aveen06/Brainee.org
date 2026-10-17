import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "@/db/graph-query";
import { createDb } from "../db";
import {
	notifications,
	projectDailyUpdates,
	projectEodReports,
	projectEvents,
	projectMembers,
	projects,
	users,
} from "../db/schema";
import { resolveEodSubmissionState } from "../lib/eod-policy";
import { assertProjectAccess } from "../lib/project-access";
import { authMiddleware } from "../lib/server-fn";
import {
	finaliseEodReportSchema,
	remindMissingSchema,
	saveEodReportSchema,
} from "./project-eod-schema";

export const saveEodReport = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => saveEodReportSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();

		const [report] = await db
			.select()
			.from(projectEodReports)
			.where(eq(projectEodReports.id, input.reportId))
			.limit(1);

		if (!report) return { error: "EOD report not found." };
		await assertProjectAccess(
			db,
			context.user,
			report.projectId,
			"contributor",
		);

		await db
			.update(projectEodReports)
			.set({
				contentFinal: input.contentFinal,
				updatedAt: new Date(),
			})
			.where(eq(projectEodReports.id, input.reportId));

		return { success: true };
	});

export const finaliseEodReport = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => finaliseEodReportSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();

		const [report] = await db
			.select()
			.from(projectEodReports)
			.where(eq(projectEodReports.id, input.reportId))
			.limit(1);

		if (!report) return { error: "EOD report not found." };
		await assertProjectAccess(db, context.user, report.projectId, "manager");

		await db
			.update(projectEodReports)
			.set({
				contentFinal: input.contentFinal || report.contentFinal,
				status: "finalised",
				finalisedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(projectEodReports.id, input.reportId));

		await db.insert(projectEvents).values({
			id: crypto.randomUUID(),
			projectId: report.projectId,
			eventType: "eod_report_finalised",
			actorId: context.user.id,
			entityType: "eod_report",
			entityId: report.id,
			details: JSON.stringify({ date: report.date }),
			createdAt: new Date(),
		});

		return { success: true };
	});

export const remindMissingSubmitters = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => remindMissingSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		await assertProjectAccess(db, context.user, input.projectId, "contributor");

		const [project] = await db
			.select({ id: projects.id, code: projects.code, name: projects.name })
			.from(projects)
			.where(eq(projects.id, input.projectId))
			.limit(1);

		if (!project) return { error: "Project not found." };

		const members = await db
			.select({
				userId: projectMembers.userId,
				userName: users.name,
				role: projectMembers.role,
				isCurrent: projectMembers.isCurrent,
			})
			.from(projectMembers)
			.leftJoin(users, eq(projectMembers.userId, users.id))
			.where(eq(projectMembers.projectId, input.projectId));

		const updates = await db
			.select({
				userId: projectDailyUpdates.userId,
				status: projectDailyUpdates.status,
			})
			.from(projectDailyUpdates)
			.where(
				and(
					eq(projectDailyUpdates.projectId, input.projectId),
					eq(projectDailyUpdates.date, input.date),
				),
			);

		const submissionState = resolveEodSubmissionState({
			members,
			submittedUpdates: updates,
			callerRole: "manager",
		});

		let remindedCount = 0;
		for (const missingUser of submissionState.missing) {
			await db.insert(notifications).values({
				id: crypto.randomUUID(),
				userId: missingUser.userId,
				type: "eod_reminder",
				title: `Daily Update Reminder: [${project.code}]`,
				body: `Please log your daily standup update for ${project.name} (${input.date}) so the EOD report can be finalized.`,
				isRead: false,
				relatedId: project.id,
				relatedType: "project",
				actionUrl: `/projects/${project.id}?tab=eod`,
				createdAt: new Date(),
			});
			remindedCount++;
		}

		return { success: true, remindedCount };
	});
