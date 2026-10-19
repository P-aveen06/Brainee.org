import { and, desc, eq, like, ne } from "@/db/graph-query";
import {
	projectChecklistItems,
	projectComments,
	projectDocuments,
	projectEvents,
	users,
} from "@/db/schema";
import { assertProjectAccess } from "@/lib/project-access";
import type { ToolHandler } from "./tool-types";

export const getProjectChecklistTool: ToolHandler = {
	name: "get_project_checklist",
	description:
		"Get a project's checklist items grouped by stage, with required/completed counts per stage.",
	parameters: {
		type: "object",
		properties: {
			projectId: { type: "string", description: "The project ID" },
		},
		required: ["projectId"],
	},
	async execute(args, ctx) {
		const projectId = String(args.projectId);
		let canonicalId = projectId;
		try {
			const access = await assertProjectAccess(
				ctx.db,
				ctx.user,
				projectId,
				"viewer",
			);
			if (access.projectId) canonicalId = access.projectId;
		} catch {
			return { success: false, error: "Project not found." };
		}

		const items = await ctx.db
			.select({
				id: projectChecklistItems.id,
				stageKey: projectChecklistItems.stageKey,
				title: projectChecklistItems.title,
				isRequired: projectChecklistItems.isRequired,
				status: projectChecklistItems.status,
				dueDate: projectChecklistItems.dueDate,
			})
			.from(projectChecklistItems)
			.where(eq(projectChecklistItems.projectId, canonicalId))
			.orderBy(projectChecklistItems.stageKey, projectChecklistItems.sequence);

		const byStage = new Map<string, typeof items>();
		for (const item of items) {
			const list = byStage.get(item.stageKey) || [];
			list.push(item);
			byStage.set(item.stageKey, list);
		}

		const isMet = (status: string) =>
			status === "done" || status === "not_applicable";

		const stages = Array.from(byStage.entries()).map(
			([stageKey, stageItems]) => {
				const required = stageItems.filter((i) => i.isRequired);
				return {
					stageKey,
					totalItems: stageItems.length,
					completedItems: stageItems.filter((i) => isMet(i.status)).length,
					requiredCount: required.length,
					requiredMetCount: required.filter((i) => isMet(i.status)).length,
					items: stageItems.map((i) => ({
						id: i.id,
						title: i.title,
						isRequired: i.isRequired,
						status: i.status,
						dueDate: i.dueDate,
					})),
				};
			},
		);

		return {
			success: true,
			data: { projectId, stages },
			scopeProjectIds: [canonicalId],
			groundedRecordIds: items.map((i) => i.id),
			groundedLabels: items.map((i) => ({ id: i.id, label: i.title })),
		};
	},
};

export const getProjectDocumentsTool: ToolHandler = {
	name: "get_project_documents",
	description:
		"List and search a project's documents by title or category (proposal, sow, contract, design, report, minutes). " +
		"Never returns raw file contents.",
	parameters: {
		type: "object",
		properties: {
			projectId: { type: "string", description: "The project ID" },
			query: {
				type: "string",
				description:
					"Search document title (e.g. 'SRS', 'Design', 'Architecture', 'Contract')",
			},
			category: {
				type: "string",
				description:
					"Filter by category: proposal, sow, contract, design, report, minutes, other",
			},
		},
		required: ["projectId"],
	},
	async execute(args, ctx) {
		const projectId = String(args.projectId);
		let canonicalId = projectId;
		try {
			const access = await assertProjectAccess(
				ctx.db,
				ctx.user,
				projectId,
				"viewer",
			);
			if (access.projectId) canonicalId = access.projectId;
		} catch {
			return { success: false, error: "Project not found." };
		}

		const conditions = [
			eq(projectDocuments.projectId, canonicalId),
			ne(projectDocuments.status, "superseded"),
		];
		if (typeof args.category === "string" && args.category.trim()) {
			conditions.push(
				eq(
					projectDocuments.category,
					args.category.trim() as typeof projectDocuments.$inferSelect.category,
				),
			);
		}
		if (typeof args.query === "string" && args.query.trim()) {
			conditions.push(like(projectDocuments.title, `%${args.query.trim()}%`));
		}

		const docs = await ctx.db
			.select({
				id: projectDocuments.id,
				title: projectDocuments.title,
				category: projectDocuments.category,
				version: projectDocuments.version,
				status: projectDocuments.status,
				uploaderName: users.name,
				createdAt: projectDocuments.createdAt,
			})
			.from(projectDocuments)
			.leftJoin(users, eq(projectDocuments.uploadedById, users.id))
			.where(and(...conditions))
			.orderBy(desc(projectDocuments.createdAt))
			.limit(100);

		return {
			success: true,
			data: docs,
			scopeProjectIds: [canonicalId],
			groundedRecordIds: docs.map((d) => d.id),
			groundedLabels: docs.map((d) => ({ id: d.id, label: d.title })),
		};
	},
};

export const getProjectTimelineTool: ToolHandler = {
	name: "get_project_timeline",
	description:
		"Get a project's recent event timeline (stage changes, task updates, document uploads, decisions), newest first, capped.",
	parameters: {
		type: "object",
		properties: {
			projectId: { type: "string", description: "The project ID" },
			limit: {
				type: "number",
				description: "Max events to return (default 20, max 100)",
			},
		},
		required: ["projectId"],
	},
	async execute(args, ctx) {
		const projectId = String(args.projectId);
		let canonicalId = projectId;
		try {
			const access = await assertProjectAccess(
				ctx.db,
				ctx.user,
				projectId,
				"viewer",
			);
			if (access.projectId) canonicalId = access.projectId;
		} catch {
			return { success: false, error: "Project not found." };
		}
		const limit =
			typeof args.limit === "number" ? Math.min(args.limit, 100) : 20;

		const events = await ctx.db
			.select({
				id: projectEvents.id,
				eventType: projectEvents.eventType,
				actorName: users.name,
				entityType: projectEvents.entityType,
				details: projectEvents.details,
				createdAt: projectEvents.createdAt,
			})
			.from(projectEvents)
			.leftJoin(users, eq(projectEvents.actorId, users.id))
			.where(eq(projectEvents.projectId, canonicalId))
			.orderBy(desc(projectEvents.createdAt))
			.limit(limit);

		return {
			success: true,
			data: events.map((e) => ({
				id: e.id,
				eventType: e.eventType,
				actorName: e.actorName,
				entityType: e.entityType,
				details: e.details ? JSON.parse(e.details) : null,
				createdAt: e.createdAt,
			})),
			scopeProjectIds: [canonicalId],
			groundedRecordIds: events.map((e) => e.id),
			groundedLabels: events.map((e) => ({ id: e.id, label: e.eventType })),
		};
	},
};

export const getProjectDiscussionsTool: ToolHandler = {
	name: "get_project_discussions",
	description:
		"Retrieve project discussions, comments, and formally flagged team decisions. " +
		"Use when asked 'what was decided', 'show decisions', or 'discussions about X'.",
	parameters: {
		type: "object",
		properties: {
			projectId: { type: "string", description: "The project ID" },
			onlyDecisions: {
				type: "boolean",
				description:
					"If true, only returns comments flagged as formal decisions",
			},
			query: {
				type: "string",
				description: "Search text within discussion/comment bodies",
			},
			limit: {
				type: "number",
				description: "Max comments to return (default 20, max 100)",
			},
		},
		required: ["projectId"],
	},
	async execute(args, ctx) {
		const projectId = String(args.projectId);
		let canonicalId = projectId;
		try {
			const access = await assertProjectAccess(
				ctx.db,
				ctx.user,
				projectId,
				"viewer",
			);
			if (access.projectId) canonicalId = access.projectId;
		} catch {
			return { success: false, error: "Project not found." };
		}
		const limit =
			typeof args.limit === "number" ? Math.min(args.limit, 100) : 20;

		const conditions = [eq(projectComments.projectId, canonicalId)];
		if (args.onlyDecisions === true) {
			conditions.push(eq(projectComments.isDecision, true));
		}
		if (typeof args.query === "string" && args.query.trim()) {
			conditions.push(like(projectComments.body, `%${args.query.trim()}%`));
		}

		const comments = await ctx.db
			.select({
				id: projectComments.id,
				authorName: users.name,
				body: projectComments.body,
				isDecision: projectComments.isDecision,
				isPinned: projectComments.isPinned,
				stageKey: projectComments.stageKey,
				createdAt: projectComments.createdAt,
			})
			.from(projectComments)
			.leftJoin(users, eq(projectComments.authorId, users.id))
			.where(and(...conditions))
			.orderBy(desc(projectComments.createdAt))
			.limit(limit);

		return {
			success: true,
			data: comments.map((c) => ({
				id: c.id,
				author: c.authorName || "Team Member",
				text: c.body,
				isDecision: Boolean(c.isDecision),
				isPinned: Boolean(c.isPinned),
				stageKey: c.stageKey,
				createdAt: c.createdAt,
			})),
			scopeProjectIds: [canonicalId],
			groundedRecordIds: comments.map((c) => c.id),
			groundedLabels: comments.map((c) => ({
				id: c.id,
				label: c.isDecision ? "Decision" : "Discussion",
			})),
		};
	},
};
