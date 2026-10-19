import { eq, like, or } from "@/db/graph-query";
import {
	projectChecklistItems,
	projectDocuments,
	projectEvents,
	projects,
	projectTasks,
	users,
} from "@/db/schema";
import { getTodayIsoDate } from "@/lib/leave-policy";
import { assertProjectAccess } from "@/lib/project-access";
import { evaluateProjectRisks } from "@/lib/project-risk";
import type { ToolHandler } from "./tool-types";

export const getProjectRisksTool: ToolHandler = {
	name: "get_project_risks",
	description:
		"Get pre-computed risk signals and health diagnostics for a project.",
	parameters: {
		type: "object",
		properties: {
			projectId: { type: "string", description: "The project ID or code" },
		},
		required: ["projectId"],
	},
	async execute(args, ctx) {
		const rawProjectId = String(args.projectId).trim();
		const [p] = await ctx.db
			.select()
			.from(projects)
			.where(
				or(
					eq(projects.id, rawProjectId),
					eq(projects.id, rawProjectId.toLowerCase()),
					eq(projects.code, rawProjectId),
					eq(projects.code, rawProjectId.toUpperCase()),
				),
			)
			.limit(1);
		if (!p) return { success: false, error: "Project not found." };

		try {
			await assertProjectAccess(ctx.db, ctx.user, p.id, "viewer");
		} catch {
			return { success: false, error: "Project not found." };
		}

		const [tasks, checklists, docs, events] = await Promise.all([
			ctx.db
				.select()
				.from(projectTasks)
				.where(eq(projectTasks.projectId, p.id)),
			ctx.db
				.select()
				.from(projectChecklistItems)
				.where(eq(projectChecklistItems.projectId, p.id)),
			ctx.db
				.select()
				.from(projectDocuments)
				.where(eq(projectDocuments.projectId, p.id)),
			ctx.db
				.select()
				.from(projectEvents)
				.where(eq(projectEvents.projectId, p.id))
				.limit(10),
		]);

		const risks = evaluateProjectRisks({
			projectId: p.id,
			projectCode: p.code,
			projectName: p.name,
			status: p.status,
			currentStageKey: p.currentStageKey || "planning",
			targetEndDate: p.targetEndDate,
			today: getTodayIsoDate(),
			tasks: tasks.map((t) => ({
				id: t.id,
				status: t.status,
				dueDate: t.dueDate,
				assigneeId: t.assigneeId,
			})),
			checklistItems: checklists.map((c) => ({
				stageKey: c.stageKey,
				isRequired: Boolean(c.isRequired),
				status: c.status,
			})),
			documents: docs.map((d) => ({
				stageKey: d.stageKey,
				category: d.category,
			})),
			recentEventCount: events.length,
			lastEventDate: events[0]
				? new Date(Number(events[0].createdAt) * 1000)
						.toISOString()
						.split("T")[0]
				: null,
		});

		return {
			success: true,
			data: { projectId: p.id, projectCode: p.code, risks },
			scopeProjectIds: [p.id],
			groundedRecordIds: [p.id, ...tasks.map((t) => t.id)],
			groundedLabels: [
				{ id: p.id, label: p.code },
				{ id: p.id, label: p.name },
				...tasks.flatMap((t) => [
					{ id: t.id, label: `#${t.taskNumber}` },
					{ id: t.id, label: t.title },
				]),
			],
		};
	},
};

export const proposeTaskUpdateTool: ToolHandler = {
	name: "propose_task_status_update",
	description:
		"Propose changing the status of a task. Emits a proposal requiring human confirmation. " +
		"Requires the task's real ID — if the user named it by title or description, call " +
		"get_my_tasks or get_project_tasks first to find the matching task's real ID; never ask " +
		"the user to supply a raw task ID themselves.",
	parameters: {
		type: "object",
		properties: {
			taskId: {
				type: "string",
				description:
					"The task's real ID, from a prior get_my_tasks/get_project_tasks/get_project_risks result — not something the user provides directly",
			},
			newStatus: {
				type: "string",
				enum: [
					"todo",
					"in_progress",
					"in_review",
					"done",
					"blocked",
					"cancelled",
				],
			},
			reason: {
				type: "string",
				description: "Why the status change is proposed",
			},
		},
		required: ["taskId", "newStatus"],
	},
	async execute(args, ctx) {
		const rawTaskId = String(args.taskId).trim();
		const newStatus = String(args.newStatus);
		const reason = args.reason
			? String(args.reason)
			: "Status update proposed by Assistant";

		const numericMatch = rawTaskId.match(/^#?(\d+)$/);
		const taskNumber = numericMatch ? Number(numericMatch[1]) : null;

		const conditions = [eq(projectTasks.id, rawTaskId)];
		if (taskNumber !== null) {
			conditions.push(eq(projectTasks.taskNumber, taskNumber));
		}

		const [task] = await ctx.db
			.select()
			.from(projectTasks)
			.where(or(...conditions))
			.limit(1);
		if (!task) return { success: false, error: "Task not found." };

		try {
			await assertProjectAccess(
				ctx.db,
				ctx.user,
				task.projectId,
				"contributor",
			);
		} catch {
			return {
				success: false,
				error: "Not authorized to update tasks on this project.",
			};
		}

		return {
			success: true,
			data: {
				message: `Proposal created: Move task #${task.taskNumber} (${task.title}) from '${task.status}' to '${newStatus}'.`,
				task: {
					id: task.id,
					title: task.title,
					currentStatus: task.status,
					targetStatus: newStatus,
				},
			},
			groundedRecordIds: [task.id, task.projectId],
			groundedLabels: [
				{ id: task.id, label: `#${task.taskNumber}` },
				{ id: task.id, label: task.title },
			],
			proposedAction: {
				actionType: "update_task_status",
				targetEntityType: "task",
				targetEntityId: task.id,
				payload: { newStatus, previousStatus: task.status, reason },
			},
		};
	},
};

export const proposeProjectTaskTool: ToolHandler = {
	name: "propose_project_task",
	description:
		"Propose creating a task in an existing project. Use for confirmed user requests and for action items extracted from a meeting transcript. The task is created only after human confirmation.",
	parameters: {
		type: "object",
		properties: {
			projectId: {
				type: "string",
				description: "A real project ID returned by a project lookup tool",
			},
			title: { type: "string", description: "A concise task title" },
			description: {
				type: "string",
				description:
					"Relevant context, acceptance criteria, or transcript source",
			},
			priority: {
				type: "string",
				enum: ["low", "medium", "high", "critical"],
			},
			stageKey: { type: "string" },
			assigneeId: {
				type: "string",
				description: "A verified employee ID, when the owner is unambiguous",
			},
			startDate: { type: "string", description: "ISO date, YYYY-MM-DD" },
			dueDate: { type: "string", description: "ISO date, YYYY-MM-DD" },
			estimateHours: { type: "number", minimum: 0 },
		},
		required: ["projectId", "title"],
	},
	async execute(args, ctx) {
		const title = String(args.title).trim();
		if (!title) return { success: false, error: "Task title is required." };

		const rawProjectId = String(args.projectId).trim();
		const [project] = await ctx.db
			.select({ id: projects.id, code: projects.code, name: projects.name })
			.from(projects)
			.where(
				or(
					eq(projects.id, rawProjectId),
					eq(projects.id, rawProjectId.toLowerCase()),
					eq(projects.code, rawProjectId),
					eq(projects.code, rawProjectId.toUpperCase()),
				),
			)
			.limit(1);
		if (!project) return { success: false, error: "Project not found." };

		try {
			await assertProjectAccess(ctx.db, ctx.user, project.id, "contributor");
		} catch {
			return {
				success: false,
				error: "Not authorized to create tasks on this project.",
			};
		}

		const allowedPriorities = ["low", "medium", "high", "critical"] as const;
		const requestedPriority = String(args.priority || "medium");
		const priority = allowedPriorities.find(
			(value) => value === requestedPriority,
		);
		if (!priority) return { success: false, error: "Invalid task priority." };

		let resolvedAssigneeId: string | undefined;
		if (args.assigneeId) {
			const rawAssignee = String(args.assigneeId).trim();
			const [matchedUser] = await ctx.db
				.select({ id: users.id })
				.from(users)
				.where(
					or(
						eq(users.id, rawAssignee),
						like(users.name, `%${rawAssignee}%`),
						like(users.email, `%${rawAssignee}%`),
					),
				)
				.limit(1);
			if (matchedUser) {
				resolvedAssigneeId = matchedUser.id;
			}
		}

		const payload = {
			projectId: project.id,
			title,
			description: args.description ? String(args.description) : undefined,
			priority,
			stageKey: args.stageKey ? String(args.stageKey) : undefined,
			assigneeId: resolvedAssigneeId,
			startDate: args.startDate ? String(args.startDate) : undefined,
			dueDate: args.dueDate ? String(args.dueDate) : undefined,
			estimateHours:
				typeof args.estimateHours === "number" ? args.estimateHours : undefined,
		};

		return {
			success: true,
			data: {
				message: `Proposal created: Add '${title}' to ${project.code}.`,
				project,
				task: payload,
			},
			groundedRecordIds: [project.id],
			groundedLabels: [
				{ id: project.id, label: project.code },
				{ id: project.id, label: project.name },
			],
			proposedAction: {
				actionType: "create_task",
				targetEntityType: "project",
				targetEntityId: project.id,
				payload,
			},
		};
	},
};
