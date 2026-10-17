import { callerPersona, callerTitle } from "../persona-context";
import type { ToolHandler } from "./tool-types";
import { loadWorkBrief } from "./work-brief-data";

export const getWorkBriefTool: ToolHandler = {
	name: "get_work_brief",
	description:
		"Get a briefing for the authenticated person's role: permitted project portfolio, blockers, overdue work, own priorities, team capacity, daily-update coverage, and people availability. Use for 'brief me', start my day, executive overview, architecture risks, staffing, or cross-project delivery questions. Counts and scope are computed by the server.",
	parameters: { type: "object", properties: {} },
	async execute(_args, ctx) {
		const {
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
		} = await loadWorkBrief(ctx);
		const names = new Map(people.map((person) => [person.id, person.name]));
		const open = tasks.filter(
			(task) => task.status !== "done" && task.status !== "cancelled",
		);
		const overdue = open.filter((task) => task.dueDate && task.dueDate < today);
		const blocked = open.filter((task) => task.status === "blocked");
		const projectMap = new Map(
			portfolio.map((project) => [project.id, project]),
		);
		const taskDetails = (task: (typeof tasks)[number]) => ({
			...task,
			assignee: names.get(task.assigneeId ?? "") ?? "Unassigned",
			projectCode: projectMap.get(task.projectId)?.code,
		});
		const myPriorities = open
			.filter((task) => task.assigneeId === ctx.user.id)
			.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
			.slice(0, 12)
			.map(taskDetails);
		const staffing = relevantPeople.map((person) => {
			const assignments = members.filter(
				(member) => member.userId === person.id,
			);
			return {
				id: person.id,
				name: person.name,
				title: callerTitle(person),
				manager: names.get(person.peerLeadId ?? "") ?? null,
				visibleProjectCount: ctx.user.role === "hr" ? null : assignments.length,
				visibleAllocationPercent:
					ctx.user.role === "hr"
						? null
						: assignments.reduce(
								(sum, member) => sum + (member.allocationPercent ?? 0),
								0,
							),
			};
		});
		return {
			success: true,
			data: {
				asOf: today,
				caller: {
					name: ctx.user.name,
					title: callerTitle(ctx.user),
					persona: callerPersona(ctx.user),
				},
				scope: {
					projects:
						visibleIds === "all"
							? "company-wide"
							: "assigned or owned projects",
					people: organizationScope
						? "company-wide"
						: "project colleagues and direct reports",
					truncated:
						portfolio.length === 100 ||
						tasks.length === 500 ||
						members.length === 500 ||
						updates.length === 500,
				},
				totals: {
					visibleProjects: portfolio.length,
					internalProjects: portfolio.filter(
						(project) => project.projectType === "internal",
					).length,
					clientProjects: portfolio.filter(
						(project) => project.projectType === "client",
					).length,
					openTasks: open.length,
					overdueTasks: overdue.length,
					blockedTasks: blocked.length,
					peopleInScope: relevantPeople.length,
				},
				projects: portfolio.map((project) => {
					const projectMembers = members.filter(
						(member) => member.projectId === project.id,
					);
					const submitted = new Set(
						updates
							.filter((update) => update.projectId === project.id)
							.map((update) => update.userId),
					);
					return {
						...project,
						owner: names.get(project.ownerId),
						openTasks: open.filter((task) => task.projectId === project.id)
							.length,
						overdueTasks: overdue.filter(
							(task) => task.projectId === project.id,
						).length,
						blockedTasks: blocked.filter(
							(task) => task.projectId === project.id,
						).length,
						awaitingDailyUpdate: projectMembers
							.filter(
								(member) =>
									member.role !== "viewer" && !submitted.has(member.userId),
							)
							.map((member) => names.get(member.userId) ?? member.userId),
					};
				}),
				myPriorities,
				blockers: blocked.slice(0, 20).map(taskDetails),
				overdue: overdue.slice(0, 20).map(taskDetails),
				staffing,
				availability: {
					from: today,
					to: weekEnd,
					onLeave: leaves.map((leave) => ({
						...leave,
						name: names.get(leave.userId),
					})),
					workingRemotely: wfhs.map((wfh) => ({
						...wfh,
						name: names.get(wfh.userId),
					})),
				},
				reportedBlockers: updates
					.filter((update) => update.blockers)
					.map((update) => ({
						...update,
						name: names.get(update.userId),
						projectCode: projectMap.get(update.projectId)?.code,
					})),
			},
			groundedRecordIds: [
				...projectIds,
				...tasks.map((task) => task.id),
				...relevantPeople.map((person) => person.id),
				...leaves.map((leave) => leave.id),
				...wfhs.map((wfh) => wfh.id),
			],
			groundedLabels: [
				...portfolio.map((project) => ({
					id: project.id,
					label: project.code,
				})),
				...portfolio.map((project) => ({
					id: project.id,
					label: project.name,
				})),
				...tasks.map((task) => ({
					id: task.id,
					label: `${projectMap.get(task.projectId)?.code} #${task.taskNumber}`,
				})),
				...relevantPeople.map((person) => ({
					id: person.id,
					label: person.name,
				})),
			],
		};
	},
};
