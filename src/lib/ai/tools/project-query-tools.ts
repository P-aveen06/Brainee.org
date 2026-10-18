import { and, eq, inArray, like, lte, or } from "@/db/graph-query";
import {
	clientContacts,
	companies,
	projects,
	projectTasks,
	users,
} from "@/db/schema";
import {
	assertProjectAccess,
	visibleProjectIdsFor,
} from "@/lib/project-access";
import type { ToolHandler } from "./tool-types";

export const listProjectsTool: ToolHandler = {
	name: "list_projects",
	description:
		"List projects visible to the current user, including status, code, and health. " +
		"Pass `query` to find a project by name, code, or client company name (e.g. the user " +
		"says 'Unilever' or 'the loyalty project') — call this BEFORE asking the user for a raw " +
		"project ID; only ask them to disambiguate if more than one project matches.",
	parameters: {
		type: "object",
		properties: {
			status: {
				type: "string",
				description: "Filter by status: active, completed, on_hold, etc.",
			},
			query: {
				type: "string",
				description:
					"Free-text match against the project's name, code, or client company name.",
			},
		},
	},
	async execute(args, ctx) {
		const visibleIds = await visibleProjectIdsFor(ctx.db, ctx.user);

		const rows =
			visibleIds === "all"
				? await ctx.db
						.select({
							id: projects.id,
							code: projects.code,
							name: projects.name,
							status: projects.status,
							healthOverride: projects.healthOverride,
							currentStageKey: projects.currentStageKey,
							targetEndDate: projects.targetEndDate,
							clientCompanyName: companies.name,
						})
						.from(projects)
						.leftJoin(companies, eq(projects.clientCompanyId, companies.id))
				: visibleIds.length === 0
					? []
					: await ctx.db
							.select({
								id: projects.id,
								code: projects.code,
								name: projects.name,
								status: projects.status,
								healthOverride: projects.healthOverride,
								currentStageKey: projects.currentStageKey,
								targetEndDate: projects.targetEndDate,
								clientCompanyName: companies.name,
							})
							.from(projects)
							.leftJoin(companies, eq(projects.clientCompanyId, companies.id))
							.where(inArray(projects.id, visibleIds));

		const byStatus =
			typeof args.status === "string" && args.status.trim()
				? rows.filter((p) => p.status === String(args.status).trim())
				: rows;

		const query = typeof args.query === "string" ? args.query.trim() : "";
		const normalizedQuery = query.toLowerCase();
		const filtered = query
			? byStatus.filter(
					(p) =>
						p.name.toLowerCase().includes(normalizedQuery) ||
						p.code.toLowerCase().includes(normalizedQuery) ||
						(p.clientCompanyName?.toLowerCase() || "").includes(
							normalizedQuery,
						),
				)
			: byStatus;

		return {
			success: true,
			data: filtered.map((p) => ({
				id: p.id,
				code: p.code,
				name: p.name,
				status: p.status,
				health: p.healthOverride || "green",
				currentStageKey: p.currentStageKey,
				targetEndDate: p.targetEndDate,
				clientCompanyName: p.clientCompanyName,
			})),
			groundedRecordIds: filtered.map((p) => p.id),
			groundedLabels: filtered.flatMap((p) => [
				{ id: p.id, label: p.code },
				{ id: p.id, label: p.name },
			]),
		};
	},
};

export const getProjectTool: ToolHandler = {
	name: "get_project",
	description:
		"Get detailed overview of a project (stage, client, health, dates).",
	parameters: {
		type: "object",
		properties: {
			projectId: { type: "string", description: "The project ID" },
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
		if (!p) {
			return {
				success: false,
				error: "Project not found.",
				groundedRecordIds: [],
			};
		}

		try {
			await assertProjectAccess(ctx.db, ctx.user, p.id, "viewer");
		} catch {
			return {
				success: false,
				error: "Project not found.",
				groundedRecordIds: [],
			};
		}

		let clientContact: {
			name: string;
			email: string | null;
			title: string | null;
		} | null = null;
		if (p.clientCompanyId) {
			const [cc] = await ctx.db
				.select({
					name: clientContacts.name,
					email: clientContacts.email,
					title: clientContacts.title,
				})
				.from(clientContacts)
				.where(
					and(
						eq(clientContacts.companyId, p.clientCompanyId),
						eq(clientContacts.isPrimary, true),
					),
				)
				.limit(1);
			if (cc) clientContact = cc;
		}

		return {
			success: true,
			data: {
				id: p.id,
				code: p.code,
				name: p.name,
				clientProjectName: p.clientProjectName,
				description: p.description,
				status: p.status,
				health: p.healthOverride || "green",
				currentStageKey: p.currentStageKey,
				startDate: p.startDate,
				targetEndDate: p.targetEndDate,
				clientContactName: clientContact?.name || null,
				clientContactEmail: clientContact?.email || null,
				clientContactTitle: clientContact?.title || null,
			},
			groundedRecordIds: [p.id],
			groundedLabels: [
				{ id: p.id, label: p.code },
				{ id: p.id, label: p.name },
			],
		};
	},
};

export const getProjectTasksTool: ToolHandler = {
	name: "get_project_tasks",
	description:
		"Get tasks for a project with subtasks grouped under their parent tasks, including assignees, status, and blockers.",
	parameters: {
		type: "object",
		properties: {
			projectId: { type: "string", description: "The project ID or code" },
			status: {
				type: "string",
				description:
					"Filter by task status: todo, in_progress, in_review, done, blocked",
			},
			priority: {
				type: "string",
				description: "Filter by priority: low, medium, high, urgent",
			},
			query: {
				type: "string",
				description: "Search keyword in task title or description",
			},
		},
		required: ["projectId"],
	},
	async execute(args, ctx) {
		const rawProjectId = String(args.projectId).trim();
		const [p] = await ctx.db
			.select({ id: projects.id, code: projects.code })
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

		const conditions = [eq(projectTasks.projectId, p.id)];
		if (typeof args.status === "string" && args.status.trim()) {
			conditions.push(
				eq(
					projectTasks.status,
					args.status.trim() as typeof projectTasks.$inferSelect.status,
				),
			);
		}
		if (typeof args.priority === "string" && args.priority.trim()) {
			conditions.push(
				eq(
					projectTasks.priority,
					args.priority.trim() as typeof projectTasks.$inferSelect.priority,
				),
			);
		}
		if (typeof args.query === "string" && args.query.trim()) {
			conditions.push(like(projectTasks.title, `%${args.query.trim()}%`));
		}

		const rawTasks = await ctx.db
			.select({
				id: projectTasks.id,
				taskNumber: projectTasks.taskNumber,
				title: projectTasks.title,
				status: projectTasks.status,
				priority: projectTasks.priority,
				assigneeId: projectTasks.assigneeId,
				assigneeName: users.name,
				parentTaskId: projectTasks.parentTaskId,
				blockedReason: projectTasks.blockedReason,
				dueDate: projectTasks.dueDate,
				completedAt: projectTasks.completedAt,
				estimatedHours: projectTasks.estimateHours,
				actualHours: projectTasks.actualHours,
			})
			.from(projectTasks)
			.leftJoin(users, eq(projectTasks.assigneeId, users.id))
			.where(and(...conditions))
			.orderBy(projectTasks.taskNumber)
			.limit(100);

		// Group subtasks under their parent tasks
		type RawTask = (typeof rawTasks)[number];
		const subtaskMap = new Map<string, RawTask[]>();
		for (const t of rawTasks) {
			if (t.parentTaskId) {
				const existing = subtaskMap.get(t.parentTaskId) || [];
				existing.push(t);
				subtaskMap.set(t.parentTaskId, existing);
			}
		}

		const formattedTasks = rawTasks
			.filter((t) => !t.parentTaskId)
			.map((parent) => ({
				id: parent.id,
				taskNumber: parent.taskNumber,
				title: parent.title,
				status: parent.status,
				priority: parent.priority,
				assignee: parent.assigneeName || "Unassigned",
				dueDate: parent.dueDate,
				blockedReason: parent.blockedReason,
				completedAt: parent.completedAt,
				subtasks: (subtaskMap.get(parent.id) || []).map((s) => ({
					id: s.id,
					taskNumber: s.taskNumber,
					title: s.title,
					status: s.status,
					priority: s.priority,
					assignee: s.assigneeName || "Unassigned",
					dueDate: s.dueDate,
					blockedReason: s.blockedReason,
					completedAt: s.completedAt,
				})),
			}));

		// Handle orphaned subtasks if filters excluded their parent
		const parentIdsInList = new Set(
			rawTasks.filter((t) => !t.parentTaskId).map((t) => t.id),
		);
		const orphanedSubtasks = rawTasks
			.filter((t) => t.parentTaskId && !parentIdsInList.has(t.parentTaskId))
			.map((s) => ({
				id: s.id,
				taskNumber: s.taskNumber,
				title: s.title,
				status: s.status,
				priority: s.priority,
				assignee: s.assigneeName || "Unassigned",
				parentTaskId: s.parentTaskId,
				blockedReason: s.blockedReason,
			}));

		return {
			success: true,
			data: {
				projectCode: p.code,
				totalTasks: rawTasks.length,
				tasks: formattedTasks,
				orphanedSubtasks:
					orphanedSubtasks.length > 0 ? orphanedSubtasks : undefined,
			},
			groundedRecordIds: rawTasks.map((t) => t.id),
			groundedLabels: rawTasks.flatMap((t) => [
				{ id: t.id, label: `#${t.taskNumber}` },
				{ id: t.id, label: t.title },
			]),
		};
	},
};

export const getMyTasksTool: ToolHandler = {
	name: "get_my_tasks",
	description:
		"Get the caller's own task assignments across ALL of their visible projects in one call. " +
		"Use this for any 'my tasks', 'what's due today', or 'across all projects' question — never " +
		"ask the user to name a single project for this, it already covers everything they can see.",
	parameters: {
		type: "object",
		properties: {
			status: {
				type: "string",
				description:
					"Filter by task status: todo, in_progress, in_review, done, blocked",
			},
			priority: {
				type: "string",
				description: "Filter by priority: low, medium, high, urgent",
			},
			query: {
				type: "string",
				description: "Search keyword in task title",
			},
			dueBy: {
				type: "string",
				description:
					"ISO date YYYY-MM-DD — only tasks due on or before this date (pass today's date for 'due today or overdue')",
			},
		},
	},
	async execute(args, ctx) {
		const visibleIds = await visibleProjectIdsFor(ctx.db, ctx.user);
		if (visibleIds !== "all" && visibleIds.length === 0) {
			return { success: true, data: [], groundedRecordIds: [] };
		}

		const conditions = [eq(projectTasks.assigneeId, ctx.user.id)];
		if (visibleIds !== "all") {
			conditions.push(inArray(projectTasks.projectId, visibleIds));
		}
		if (typeof args.status === "string" && args.status.trim()) {
			conditions.push(
				eq(
					projectTasks.status,
					args.status.trim() as typeof projectTasks.$inferSelect.status,
				),
			);
		}
		if (typeof args.priority === "string" && args.priority.trim()) {
			conditions.push(
				eq(
					projectTasks.priority,
					args.priority.trim() as typeof projectTasks.$inferSelect.priority,
				),
			);
		}
		if (typeof args.query === "string" && args.query.trim()) {
			conditions.push(like(projectTasks.title, `%${args.query.trim()}%`));
		}
		if (typeof args.dueBy === "string" && args.dueBy.trim()) {
			conditions.push(lte(projectTasks.dueDate, args.dueBy.trim()));
		}

		const tasks = await ctx.db
			.select({
				id: projectTasks.id,
				taskNumber: projectTasks.taskNumber,
				title: projectTasks.title,
				status: projectTasks.status,
				priority: projectTasks.priority,
				dueDate: projectTasks.dueDate,
				projectId: projectTasks.projectId,
				projectCode: projects.code,
				projectName: projects.name,
				assigneeId: projectTasks.assigneeId,
				parentTaskId: projectTasks.parentTaskId,
				estimateHours: projectTasks.estimateHours,
				actualHours: projectTasks.actualHours,
			})
			.from(projectTasks)
			.innerJoin(projects, eq(projectTasks.projectId, projects.id))
			.where(and(...conditions))
			.orderBy(projectTasks.dueDate)
			.limit(100);

		return {
			success: true,
			data: tasks.map((t) => ({
				id: t.id,
				taskNumber: t.taskNumber,
				title: t.title,
				status: t.status,
				priority: t.priority,
				dueDate: t.dueDate,
				projectCode: t.projectCode,
				projectName: t.projectName,
				assigneeId: t.assigneeId,
				assigneeName: ctx.user.name,
				parentTaskId: t.parentTaskId,
				estimateHours: t.estimateHours,
				actualHours: t.actualHours,
			})),
			groundedRecordIds: tasks.map((t) => t.id),
			groundedLabels: tasks.flatMap((t) => [
				{ id: t.id, label: `${t.projectCode} #${t.taskNumber}` },
				{ id: t.id, label: t.title },
			]),
		};
	},
};
