import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { createDb } from "../db";
import {
	projectDailyUpdates,
	projectEodReports,
	projectMembers,
	projects,
	users,
} from "../db/schema";
import { resolveEodSubmissionState } from "../lib/eod-policy";
import { getTodayIsoDate } from "../lib/leave-policy";
import { assertProjectAccess } from "../lib/project-access";
import { authMiddleware } from "../lib/server-fn";
import { getEodStatusSchema } from "./project-eod-schema";

export * from "./project-eod-actions";
export * from "./project-eod-generate";
export * from "./project-eod-schema";

export const getEodStatus = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => getEodStatusSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		const access = await assertProjectAccess(
			db,
			context.user,
			input.projectId,
			"viewer",
		);

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
				userAvatarUrl: users.avatarUrl,
				role: projectMembers.role,
				isCurrent: projectMembers.isCurrent,
			})
			.from(projectMembers)
			.leftJoin(users, eq(projectMembers.userId, users.id))
			.where(eq(projectMembers.projectId, input.projectId));

		const updates = await db
			.select({
				id: projectDailyUpdates.id,
				userId: projectDailyUpdates.userId,
				status: projectDailyUpdates.status,
				summary: projectDailyUpdates.summary,
				blockers: projectDailyUpdates.blockers,
				hoursSpent: projectDailyUpdates.hoursSpent,
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
			callerRole: access.role,
		});

		const [report] = await db
			.select({
				id: projectEodReports.id,
				projectId: projectEodReports.projectId,
				date: projectEodReports.date,
				generatedById: projectEodReports.generatedById,
				generatorName: users.name,
				contentDraft: projectEodReports.contentDraft,
				contentFinal: projectEodReports.contentFinal,
				status: projectEodReports.status,
				missingSubmitters: projectEodReports.missingSubmitters,
				finalisedAt: projectEodReports.finalisedAt,
				createdAt: projectEodReports.createdAt,
				updatedAt: projectEodReports.updatedAt,
			})
			.from(projectEodReports)
			.leftJoin(users, eq(projectEodReports.generatedById, users.id))
			.where(
				and(
					eq(projectEodReports.projectId, input.projectId),
					eq(projectEodReports.date, input.date),
				),
			)
			.limit(1);

		return {
			project,
			submissionState,
			members,
			report: report || null,
			access,
			today: getTodayIsoDate(),
		};
	});
