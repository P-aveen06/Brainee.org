import { and, count, desc, eq, like, or } from "@/db/graph-query";
import { assetAssignments, assets, timesheets } from "@/db/schema";
import type { ToolHandler } from "./tool-types";

export const getMyAssetsTool: ToolHandler = {
	name: "get_my_assets",
	description:
		"Get all IT equipment and software licenses currently assigned to the authenticated user.",
	parameters: { type: "object", properties: {} },
	async execute(_args, ctx) {
		const assignments = await ctx.db
			.select({
				assignmentId: assetAssignments.id,
				assignedDate: assetAssignments.assignedDate,
				conditionOut: assetAssignments.conditionOut,
				acknowledgedAt: assetAssignments.acknowledgedAt,
				assetId: assets.id,
				assetTag: assets.assetTag,
				name: assets.name,
				category: assets.category,
				model: assets.model,
				serialNumber: assets.serialNumber,
				warrantyExpiry: assets.warrantyExpiry,
			})
			.from(assetAssignments)
			.innerJoin(assets, eq(assetAssignments.assetId, assets.id))
			.where(
				and(
					eq(assetAssignments.userId, ctx.user.id),
					eq(assetAssignments.isCurrent, true),
				),
			);

		return {
			success: true,
			data: assignments.map((a) => ({
				assignmentId: a.assignmentId,
				assetId: a.assetId,
				assetTag: a.assetTag,
				name: a.name,
				category: a.category,
				model: a.model,
				serialNumber: a.serialNumber,
				assignedDate: a.assignedDate,
				condition: a.conditionOut,
				isAcknowledged: Boolean(a.acknowledgedAt),
				warrantyExpiry: a.warrantyExpiry,
			})),
			groundedRecordIds: assignments.map((a) => a.assetId),
			groundedLabels: assignments.flatMap((a) => [
				{ id: a.assetId, label: a.assetTag },
				{ id: a.assetId, label: a.name },
			]),
		};
	},
};

export const getAssetInventoryTool: ToolHandler = {
	name: "get_asset_inventory",
	description:
		"Search and check company IT asset inventory by brand, model, category, and status (e.g. 'Acer', 'Dell', 'laptops', 'monitors in inventory').",
	parameters: {
		type: "object",
		properties: {
			query: {
				type: "string",
				description:
					"Search brand, model, name, or asset tag (e.g. 'Acer', 'Lenovo', 'ThinkVision', 'Apple', 'Dell', 'MON-ACER-01').",
			},
			category: {
				type: "string",
				description:
					"Filter by category: laptop, monitor, mobile_device, accessory, etc.",
			},
			status: {
				type: "string",
				description:
					"Filter by status: in_inventory, assigned, maintenance, defective",
			},
		},
	},
	async execute(args, ctx) {
		if (ctx.user.role !== "admin" && ctx.user.role !== "lead") {
			return {
				success: false,
				error:
					"Only administrators and leads can query company-wide asset inventory.",
			};
		}

		const conditions = [];
		if (typeof args.category === "string" && args.category.trim())
			conditions.push(
				eq(
					assets.category,
					args.category.trim() as typeof assets.$inferSelect.category,
				),
			);
		if (typeof args.status === "string" && args.status.trim())
			conditions.push(
				eq(
					assets.status,
					args.status.trim() as typeof assets.$inferSelect.status,
				),
			);
		if (typeof args.query === "string" && args.query.trim()) {
			const q = `%${args.query.trim()}%`;
			conditions.push(
				or(
					like(assets.name, q),
					like(assets.model, q),
					like(assets.assetTag, q),
				),
			);
		}

		const where = conditions.length > 0 ? and(...conditions) : undefined;
		const [items, groups] = await Promise.all([
			ctx.db.select().from(assets).where(where).limit(100),
			ctx.db
				.select({
					name: assets.name,
					model: assets.model,
					category: assets.category,
					status: assets.status,
					count: count(assets.id),
				})
				.from(assets)
				.where(where)
				.groupBy(assets.name, assets.model, assets.category, assets.status),
		]);
		const totalCount = groups.reduce((sum, group) => sum + group.count, 0);

		return {
			success: true,
			data: {
				totalCount,
				groups,
				items: items.map((i) => ({
					id: i.id,
					assetTag: i.assetTag,
					name: i.name,
					category: i.category,
					model: i.model,
					status: i.status,
					warrantyExpiry: i.warrantyExpiry,
				})),
				truncated: totalCount > items.length,
			},
			groundedRecordIds: items.map((i) => i.id),
			groundedLabels: items.flatMap((i) => [
				{ id: i.id, label: i.assetTag },
				{ id: i.id, label: i.name },
			]),
		};
	},
};

export const getMyTimesheetsTool: ToolHandler = {
	name: "get_my_timesheets",
	description:
		"Get recent timesheet entries and logged work hours for the current user.",
	parameters: {
		type: "object",
		properties: {
			limit: {
				type: "number",
				description: "Number of days to retrieve (default 14)",
			},
		},
	},
	async execute(args, ctx) {
		const limit =
			typeof args.limit === "number" ? Math.min(args.limit, 30) : 14;

		const rows = await ctx.db
			.select()
			.from(timesheets)
			.where(eq(timesheets.userId, ctx.user.id))
			.orderBy(desc(timesheets.date))
			.limit(limit);

		const totalHours = rows.reduce((sum, r) => sum + (r.hours || 0), 0);

		return {
			success: true,
			data: {
				userId: ctx.user.id,
				totalHoursLogged: totalHours,
				recentEntries: rows.map((r) => ({
					id: r.id,
					date: r.date,
					hours: r.hours,
					status: r.status,
				})),
			},
			groundedRecordIds: rows.map((r) => r.id),
			groundedLabels: rows.map((r) => ({ id: r.id, label: r.date })),
		};
	},
};

export const proposeAssetIssueReportTool: ToolHandler = {
	name: "propose_asset_issue_report",
	description:
		"Draft an equipment defect or issue report for an assigned asset. Requires human confirmation.",
	parameters: {
		type: "object",
		properties: {
			assetId: { type: "string", description: "The asset ID" },
			issueDescription: {
				type: "string",
				description: "Detailed description of the hardware/software issue",
			},
		},
		required: ["assetId", "issueDescription"],
	},
	async execute(args, ctx) {
		const rawAssetId = String(args.assetId).trim();
		const issueDescription = String(args.issueDescription);

		// Only equipment currently in the caller's own custody can be reported —
		// mirrors the restriction the real reportAssetIssue server fn enforces.
		const [assignment] = await ctx.db
			.select({
				assignmentId: assetAssignments.id,
				assetId: assets.id,
				assetTag: assets.assetTag,
				assetName: assets.name,
			})
			.from(assetAssignments)
			.innerJoin(assets, eq(assetAssignments.assetId, assets.id))
			.where(
				and(
					or(
						eq(assetAssignments.assetId, rawAssetId),
						eq(assets.id, rawAssetId),
						eq(assets.assetTag, rawAssetId),
						eq(assets.assetTag, rawAssetId.toUpperCase()),
					),
					eq(assetAssignments.userId, ctx.user.id),
					eq(assetAssignments.isCurrent, true),
				),
			)
			.limit(1);

		if (!assignment) {
			return {
				success: false,
				error:
					"No current assignment of that asset was found under your account.",
			};
		}

		return {
			success: true,
			data: {
				message: `Drafted equipment issue report for '${assignment.assetName}' (${assignment.assetTag}): "${issueDescription}".`,
				assetTag: assignment.assetTag,
				assetName: assignment.assetName,
				issueDescription,
			},
			groundedRecordIds: [assignment.assetId],
			groundedLabels: [
				{ id: assignment.assetId, label: assignment.assetTag },
				{ id: assignment.assetId, label: assignment.assetName },
			],
			proposedAction: {
				actionType: "report_asset_issue",
				targetEntityType: "asset_assignment",
				targetEntityId: assignment.assignmentId,
				payload: { issueDescription, assetTag: assignment.assetTag },
			},
		};
	},
};
