import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray } from "drizzle-orm";
import { createDb } from "../db";
import {
	clientContacts,
	projectDailyUpdateItems,
	projectDailyUpdates,
	projectEodReports,
	projectEvents,
	projectMembers,
	projects,
	projectTasks,
	users,
} from "../db/schema";
import {
	assembleEodSkeleton,
	resolveEodSubmissionState,
} from "../lib/eod-policy";
import { assertProjectAccess } from "../lib/project-access";
import { authMiddleware } from "../lib/server-fn";
import { generateEodReportSchema } from "./project-eod-schema";

export const generateEodReport = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => generateEodReportSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		const access = await assertProjectAccess(
			db,
			context.user,
			input.projectId,
			"contributor",
		);

		const [project] = await db
			.select({
				id: projects.id,
				code: projects.code,
				name: projects.name,
				clientCompanyId: projects.clientCompanyId,
				clientProjectName: projects.clientProjectName,
			})
			.from(projects)
			.where(eq(projects.id, input.projectId))
			.limit(1);

		if (!project) return { error: "Project not found." };

		let pocName = "Team";
		if (project.clientCompanyId) {
			const [contact] = await db
				.select({ name: clientContacts.name })
				.from(clientContacts)
				.where(
					and(
						eq(clientContacts.companyId, project.clientCompanyId),
						eq(clientContacts.isPrimary, true),
					),
				)
				.limit(1);
			if (contact?.name) {
				pocName = contact.name.trim().split(" ")[0];
			}
		}

		const tasks = await db
			.select({
				taskNumber: projectTasks.taskNumber,
				title: projectTasks.title,
				status: projectTasks.status,
				dueDate: projectTasks.dueDate,
				blockedReason: projectTasks.blockedReason,
				completedAt: projectTasks.completedAt,
			})
			.from(projectTasks)
			.where(eq(projectTasks.projectId, input.projectId))
			.orderBy(projectTasks.taskNumber);

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

		const rawUpdates = await db
			.select({
				id: projectDailyUpdates.id,
				userId: projectDailyUpdates.userId,
				userName: users.name,
				status: projectDailyUpdates.status,
				summary: projectDailyUpdates.summary,
				blockers: projectDailyUpdates.blockers,
				hoursSpent: projectDailyUpdates.hoursSpent,
			})
			.from(projectDailyUpdates)
			.leftJoin(users, eq(projectDailyUpdates.userId, users.id))
			.where(
				and(
					eq(projectDailyUpdates.projectId, input.projectId),
					eq(projectDailyUpdates.date, input.date),
				),
			);

		const submissionState = resolveEodSubmissionState({
			members,
			submittedUpdates: rawUpdates,
			callerRole: access.role,
		});

		if (!submissionState.canGenerate) {
			return {
				error:
					"Cannot generate EOD report yet: not all team members have submitted, and you do not have manager override permissions.",
			};
		}

		const submittedUpdateIds = rawUpdates
			.filter((u) => u.status === "submitted")
			.map((u) => u.id);

		let itemsMap: Record<
			string,
			Array<{
				taskNumber: number;
				title: string;
				note?: string | null;
				progressNote?: string | null;
			}>
		> = {};

		if (submittedUpdateIds.length > 0) {
			const items = await db
				.select({
					updateId: projectDailyUpdateItems.updateId,
					taskNumber: projectTasks.taskNumber,
					taskTitle: projectTasks.title,
					note: projectDailyUpdateItems.note,
					progressNote: projectDailyUpdateItems.progressNote,
				})
				.from(projectDailyUpdateItems)
				.leftJoin(
					projectTasks,
					eq(projectDailyUpdateItems.taskId, projectTasks.id),
				)
				.where(inArray(projectDailyUpdateItems.updateId, submittedUpdateIds));

			itemsMap = items.reduce(
				(acc, cur) => {
					if (!acc[cur.updateId]) acc[cur.updateId] = [];
					acc[cur.updateId].push({
						taskNumber: cur.taskNumber || 0,
						title: cur.taskTitle || "Task",
						note: cur.note,
						progressNote: cur.progressNote,
					});
					return acc;
				},
				{} as typeof itemsMap,
			);
		}

		const formattedUpdates = rawUpdates
			.filter((u) => u.status === "submitted")
			.map((u) => ({
				userId: u.userId,
				userName: u.userName || "Team Member",
				summary: u.summary,
				blockers: u.blockers,
				hoursSpent: u.hoursSpent,
				items: itemsMap[u.id] || [],
			}));

		const skeleton = assembleEodSkeleton({
			projectCode: project.code,
			projectName: project.clientProjectName || project.name,
			date: input.date,
			pocName,
			updates: formattedUpdates,
			tasks,
			missingMembers: submissionState.missing,
		});

		const [existingReport] = await db
			.select({ id: projectEodReports.id })
			.from(projectEodReports)
			.where(
				and(
					eq(projectEodReports.projectId, input.projectId),
					eq(projectEodReports.date, input.date),
				),
			)
			.limit(1);

		let reportId = existingReport?.id;
		const missingJson = JSON.stringify(
			submissionState.missing.map((m) => m.userId),
		);

		if (existingReport) {
			await db
				.update(projectEodReports)
				.set({
					generatedById: context.user.id,
					contentDraft: skeleton.contentDraft,
					contentFinal: skeleton.contentDraft,
					missingSubmitters: missingJson,
					updatedAt: new Date(),
				})
				.where(eq(projectEodReports.id, existingReport.id));
		} else {
			reportId = crypto.randomUUID();
			await db.insert(projectEodReports).values({
				id: reportId,
				projectId: input.projectId,
				date: input.date,
				generatedById: context.user.id,
				contentDraft: skeleton.contentDraft,
				contentFinal: skeleton.contentDraft,
				status: "draft",
				missingSubmitters: missingJson,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		await db.insert(projectEvents).values({
			id: crypto.randomUUID(),
			projectId: input.projectId,
			eventType: "eod_report_generated",
			actorId: context.user.id,
			entityType: "eod_report",
			entityId: reportId,
			details: JSON.stringify({
				date: input.date,
				missingCount: submissionState.missing.length,
			}),
			createdAt: new Date(),
		});

		return { success: true, reportId };
	});
