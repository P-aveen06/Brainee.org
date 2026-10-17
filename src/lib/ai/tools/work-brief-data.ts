import { and, eq, gte, inArray, lte } from "@/db/graph-query";
import {
	companies,
	leaveRequests,
	projectDailyUpdates,
	projectMembers,
	projects,
	projectTasks,
	users,
	wfhRequests,
} from "@/db/schema";
import { addIsoDays, getTodayIsoDate } from "@/lib/leave-policy";
import { visibleProjectIdsFor } from "@/lib/project-access";
import type { ToolContext } from "./tool-types";

export async function loadWorkBrief(ctx: ToolContext) {
	const today = getTodayIsoDate(),
		weekEnd = addIsoDays(today, 7);
	const visibleIds = await visibleProjectIdsFor(ctx.db, ctx.user);
	const people = await ctx.db
		.select({
			id: users.id,
			name: users.name,
			authId: users.authId,
			role: users.role,
			peerLeadId: users.peerLeadId,
		})
		.from(users)
		.where(eq(users.isActive, true));
	const portfolio =
		visibleIds !== "all" && !visibleIds.length
			? []
			: await ctx.db
					.select({
						id: projects.id,
						code: projects.code,
						name: projects.name,
						ownerId: projects.ownerId,
						projectType: projects.projectType,
						stage: projects.currentStageKey,
						status: projects.status,
						health: projects.healthOverride,
						targetEndDate: projects.targetEndDate,
						client: companies.name,
					})
					.from(projects)
					.leftJoin(companies, eq(projects.clientCompanyId, companies.id))
					.where(
						visibleIds === "all" ? undefined : inArray(projects.id, visibleIds),
					)
					.limit(100);
	const projectIds = portfolio.map((project) => project.id);
	const [tasks, members, updates] = projectIds.length
		? await Promise.all([
				ctx.db
					.select({
						id: projectTasks.id,
						projectId: projectTasks.projectId,
						taskNumber: projectTasks.taskNumber,
						title: projectTasks.title,
						status: projectTasks.status,
						priority: projectTasks.priority,
						assigneeId: projectTasks.assigneeId,
						dueDate: projectTasks.dueDate,
						blockedReason: projectTasks.blockedReason,
					})
					.from(projectTasks)
					.where(inArray(projectTasks.projectId, projectIds))
					.limit(500),
				ctx.db
					.select({
						projectId: projectMembers.projectId,
						userId: projectMembers.userId,
						role: projectMembers.role,
						allocationPercent: projectMembers.allocationPercent,
					})
					.from(projectMembers)
					.where(
						and(
							inArray(projectMembers.projectId, projectIds),
							eq(projectMembers.isCurrent, true),
						),
					)
					.limit(500),
				ctx.db
					.select({
						projectId: projectDailyUpdates.projectId,
						userId: projectDailyUpdates.userId,
						blockers: projectDailyUpdates.blockers,
						hoursSpent: projectDailyUpdates.hoursSpent,
					})
					.from(projectDailyUpdates)
					.where(
						and(
							inArray(projectDailyUpdates.projectId, projectIds),
							eq(projectDailyUpdates.date, today),
							eq(projectDailyUpdates.status, "submitted"),
						),
					)
					.limit(500),
			])
		: [[], [], []];
	const organizationScope = ctx.user.role === "admin" || ctx.user.role === "hr";
	const relevantIds = new Set([
		ctx.user.id,
		...members.map((member) => member.userId),
		...people
			.filter((person) => person.peerLeadId === ctx.user.id)
			.map((person) => person.id),
	]);
	const relevantPeople = organizationScope
		? people
		: people.filter((person) => relevantIds.has(person.id));
	const personIds = relevantPeople.map((person) => person.id);
	const [leaves, wfhs] = personIds.length
		? await Promise.all([
				ctx.db
					.select({
						id: leaveRequests.id,
						userId: leaveRequests.userId,
						startDate: leaveRequests.startDate,
						endDate: leaveRequests.endDate,
					})
					.from(leaveRequests)
					.where(
						and(
							inArray(leaveRequests.userId, personIds),
							eq(leaveRequests.status, "approved"),
							lte(leaveRequests.startDate, weekEnd),
							gte(leaveRequests.endDate, today),
						),
					),
				ctx.db
					.select({
						id: wfhRequests.id,
						userId: wfhRequests.userId,
						date: wfhRequests.date,
					})
					.from(wfhRequests)
					.where(
						and(
							inArray(wfhRequests.userId, personIds),
							eq(wfhRequests.status, "approved"),
							gte(wfhRequests.date, today),
							lte(wfhRequests.date, weekEnd),
						),
					),
			])
		: [[], []];

	return {
		today,
		weekEnd,
		visibleIds,
		people,
		portfolio,
		projectIds,
		tasks,
		members,
		updates,
		organizationScope,
		relevantPeople,
		leaves,
		wfhs,
	};
}
