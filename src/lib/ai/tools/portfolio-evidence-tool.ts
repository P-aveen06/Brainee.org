import { and, desc, eq, inArray, like, ne } from "@/db/graph-query";
import {
	projectTasks,
	projectChecklistItems,
	projectDocuments,
	projectComments,
	projectEvents,
	users,
} from "@/db/schema";
import type { CitationRef } from "../citations";
import { listProjectsTool } from "./project-query-tools";
import type { ToolHandler } from "./tool-types";

/** One bounded query across permitted projects avoids ten calls per evidence section. */
export const getPortfolioEvidenceTool: ToolHandler = {
	name: "get_portfolio_evidence",
	description:
		"Read one evidence section across ALL permitted projects in one call: tasks (with assignees/effort), required checklist items, current documents, decisions or timeline. Use for portfolio-wide comparisons instead of a separate tool call for every project. Continue with nextOffset until complete before claiming a full inventory. Project current stage differs from a checklist's own stage.",
	parameters: {
		type: "object",
		properties: {
			section: {
				type: "string",
				enum: ["tasks", "checklists", "documents", "decisions", "timeline"],
			},
			projectQuery: {
				type: "string",
				description: "Optional single project name/code/client filter",
			},
			query: {
				type: "string",
				description: "Optional title/body substring, e.g. architecture review",
			},
			onlyMine: { type: "boolean" },
			offset: { type: "integer", minimum: 0, maximum: 10000 },
			limit: { type: "integer", minimum: 1, maximum: 100 },
		},
		required: ["section"],
	},
	async execute(args, ctx) {
		const offset = args.offset ?? 0,
			limit = args.limit ?? 100;
		if (
			!Number.isInteger(offset) ||
			Number(offset) < 0 ||
			Number(offset) > 10000 ||
			!Number.isInteger(limit) ||
			Number(limit) < 1 ||
			Number(limit) > 100
		)
			return { success: false, error: "Invalid evidence pagination." };
		const result = await listProjectsTool.execute(
			{ query: args.projectQuery },
			ctx,
		);
		const projects = result.data as Array<{
			id: string;
			code: string;
			name: string;
			currentStageKey: string;
		}>;
		const ids = projects.map((p) => p.id),
			byId = new Map(projects.map((p) => [p.id, p]));
		const query =
			typeof args.query === "string" && args.query.trim()
				? `%${args.query.trim()}%`
				: undefined;
		let rows: Array<Record<string, unknown>> = [];
		if (ids.length) {
			switch (args.section) {
				case "tasks":
					rows = await ctx.db
						.select({
							id: projectTasks.id,
							projectId: projectTasks.projectId,
							taskNumber: projectTasks.taskNumber,
							title: projectTasks.title,
							status: projectTasks.status,
							assigneeId: projectTasks.assigneeId,
							assigneeName: users.name,
							dueDate: projectTasks.dueDate,
							parentTaskId: projectTasks.parentTaskId,
							blockedReason: projectTasks.blockedReason,
							estimateHours: projectTasks.estimateHours,
							actualHours: projectTasks.actualHours,
						})
						.from(projectTasks)
						.leftJoin(users, eq(projectTasks.assigneeId, users.id))
						.where(
							and(
								inArray(projectTasks.projectId, ids),
								query ? like(projectTasks.title, query) : undefined,
								args.onlyMine === true
									? eq(projectTasks.assigneeId, ctx.user.id)
									: undefined,
							),
						)
						.orderBy(projectTasks.id)
						.offset(Number(offset))
						.limit(Number(limit) + 1);
					break;
				case "checklists":
					rows = await ctx.db
						.select()
						.from(projectChecklistItems)
						.where(
							and(
								inArray(projectChecklistItems.projectId, ids),
								eq(projectChecklistItems.isRequired, true),
							),
						)
						.orderBy(projectChecklistItems.id)
						.offset(Number(offset))
						.limit(Number(limit) + 1);
					break;
				case "documents":
					rows = await ctx.db
						.select({
							id: projectDocuments.id,
							projectId: projectDocuments.projectId,
							title: projectDocuments.title,
							status: projectDocuments.status,
							version: projectDocuments.version,
							category: projectDocuments.category,
						})
						.from(projectDocuments)
						.where(
							and(
								inArray(projectDocuments.projectId, ids),
								ne(projectDocuments.status, "superseded"),
								query ? like(projectDocuments.title, query) : undefined,
							),
						)
						.orderBy(projectDocuments.id)
						.offset(Number(offset))
						.limit(Number(limit) + 1);
					break;
				case "decisions":
					rows = await ctx.db
						.select({
							id: projectComments.id,
							projectId: projectComments.projectId,
							body: projectComments.body,
							taskId: projectComments.taskId,
							documentId: projectComments.documentId,
							createdAt: projectComments.createdAt,
							isDecision: projectComments.isDecision,
						})
						.from(projectComments)
						.where(
							and(
								inArray(projectComments.projectId, ids),
								eq(projectComments.isDecision, true),
								query ? like(projectComments.body, query) : undefined,
							),
						)
						.orderBy(desc(projectComments.createdAt), projectComments.id)
						.offset(Number(offset))
						.limit(Number(limit) + 1);
					break;
				case "timeline":
					rows = await ctx.db
						.select()
						.from(projectEvents)
						.where(inArray(projectEvents.projectId, ids))
						.orderBy(desc(projectEvents.createdAt), projectEvents.id)
						.offset(Number(offset))
						.limit(Number(limit) + 1);
					break;
				default:
					return {
						success: false,
						error: "Unknown portfolio evidence section.",
					};
			}
		}
		const complete = rows.length <= Number(limit);
		const items: Array<Record<string, unknown>> = rows
			.slice(0, Number(limit))
			.map((row) => ({
				...row,
				projectCode: byId.get(String(row.projectId))?.code,
				projectCurrentStage: byId.get(String(row.projectId))?.currentStageKey,
			}));
		const type: CitationRef["type"] =
			args.section === "tasks"
				? "task"
				: args.section === "checklists"
					? "checklist"
					: args.section === "documents"
						? "document"
						: args.section === "decisions"
							? "decision"
							: "project";
		return {
			success: true,
			scopeProjectIds: ids,
			data: {
				scope: "permitted_projects",
				projects,
				section: args.section,
				items,
				complete,
				nextOffset: complete ? null : Number(offset) + Number(limit),
				semantics:
					"Open means todo, in_progress, in_review or blocked; blocked is a subset of open. Count each task ID once. Checklist stage is the item's phase, not necessarily the project's current phase. No entries is a complete absence only if complete=true.",
			},
			groundedRecordIds: items.map((item) => String(item.id)),
			groundedLabels: items.map((item) => ({
				id: String(item.id),
				type,
				label: `${item.projectCode} ${item.taskNumber ? `#${item.taskNumber}` : (item.title ?? item.eventType ?? args.section)}`,
			})),
		};
	},
};
