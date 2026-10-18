import { z } from "zod";
import { graphOperation } from "@/db/transport.server";
import { assertProjectAccess } from "@/lib/project-access";
import { parseDeliveryResult } from "../../../../shared/delivery-knowledge";
import { adaptEstimate } from "../adapted-estimate";
import type { ToolHandler } from "./tool-types";

const itemSchema = z.object({
	sourceProjectId: z.string().min(1),
	sourceTaskId: z.string().min(1),
	title: z.string().trim().min(1).max(300),
	description: z.string().max(4000),
	matchedScope: z.string().min(1).max(2000),
	scopeChanges: z.string().min(1).max(2000),
	assumptions: z.string().min(1).max(2000),
	factor: z.number().min(0.25).max(4),
	additionalHours: z.number().min(0).max(1000),
});
const schema = z.object({
	destinationProjectId: z.string().min(1),
	items: z.array(itemSchema).min(1).max(10),
});

export const proposeReusableBreakdownTool: ToolHandler = {
	name: "propose_reusable_breakdown",
	description:
		"Draft up to ten editable destination-project tasks from discovered source tasks. Supply matched scope, scope changes and assumptions for each. The server verifies source evidence and calculates adapted hours from actuals or estimates; unknown effort stays unknown. Each task is a separate editable confirmation card, preserving source provenance. Does not assign people or create tasks until confirmation.",
	timeoutMs: 40000,
	parameters: {
		type: "object",
		required: ["destinationProjectId", "items"],
		properties: {
			destinationProjectId: { type: "string" },
			items: {
				type: "array",
				minItems: 1,
				maxItems: 10,
				items: {
					type: "object",
					required: [
						"sourceProjectId",
						"sourceTaskId",
						"title",
						"description",
						"matchedScope",
						"scopeChanges",
						"assumptions",
						"factor",
						"additionalHours",
					],
					properties: Object.fromEntries(
						Object.keys(itemSchema.shape).map((key) => [
							key,
							key === "factor"
								? { type: "number", minimum: 0.25, maximum: 4 }
								: key === "additionalHours"
									? { type: "number", minimum: 0, maximum: 1000 }
									: { type: "string" },
						]),
					),
				},
			},
		},
	},
	async execute(args, ctx) {
		const input = schema.parse(args);
		const access = await assertProjectAccess(
			ctx.db,
			ctx.user,
			input.destinationProjectId,
			"contributor",
		);
		const projectId = access.projectId!;
		const sources = [];
		const drafts = [];
		for (const item of input.items) {
			const context = parseDeliveryResult(
				await graphOperation("delivery.context", {
					projectId: item.sourceProjectId,
					taskId: item.sourceTaskId,
					section: "tasks",
					limit: 100,
					offset: 0,
				}),
			);
			const page = context.tasks as {
				items: Array<{
					id: string;
					taskNumber: number;
					estimateHours: number | null;
					actualHours: number | null;
					isLeaf: boolean;
				}>;
				hasMore: boolean;
			};
			const source = page.items.find((task) => task.id === item.sourceTaskId);
			if (!source)
				return {
					success: false,
					error:
						"Source task is not in the returned evidence page. Expand the task family before drafting.",
				};
			if (!source.isLeaf && context.rootTaskId !== source.id)
				return {
					success: false,
					error:
						"Choose a leaf task or the returned root task. Family totals cannot be attributed to an intermediate task.",
				};
			const project = context.project as { id: string; projectCode: string };
			const totals = context.estimateSummary as {
				estimatedHours: number | null;
				actualHours: number | null;
				missingLeafEstimates: number;
				missingLeafActuals: number;
			};
			const estimate = adaptEstimate({
				estimateHours: source.isLeaf
					? (source.estimateHours ?? null)
					: totals.missingLeafEstimates === 0
						? totals.estimatedHours
						: null,
				actualHours: source.isLeaf
					? (source.actualHours ?? null)
					: totals.missingLeafActuals === 0
						? totals.actualHours
						: null,
				factor: item.factor,
				additionalHours: item.additionalHours,
				complete:
					!page.hasMore &&
					(source.isLeaf ||
						(totals.missingLeafEstimates === 0 &&
							totals.missingLeafActuals === 0)),
			});
			const sourceLabel = `${project.projectCode} #${source.taskNumber}`;
			const provenance = {
				sourceTaskId: source.id,
				sourceProjectId: project.id,
				adaptationAssumptions: JSON.stringify({
					matchedScope: item.matchedScope,
					scopeChanges: item.scopeChanges,
					assumptions: item.assumptions,
					estimate,
				}),
			};
			drafts.push({
				projectId,
				title: item.title,
				description: `${item.description}\n\nReference: ${sourceLabel}\nMatched scope: ${item.matchedScope}\nChanged scope: ${item.scopeChanges}\nAssumptions: ${item.assumptions}`,
				priority: "medium",
				estimateHours: estimate.proposedHours,
				...provenance,
			});
			sources.push({ id: source.id, label: sourceLabel });
		}
		return {
			success: true,
			data: {
				destinationProjectId: projectId,
				drafts,
				confirmation:
					"Each draft can be edited and confirmed separately. No tasks have been created.",
			},
			knowledgeScope: "company_delivery",
			groundedRecordIds: sources.map((source) => source.id),
			groundedLabels: sources,
			proposedActions: drafts.map((payload) => ({
				actionType: "create_task",
				targetEntityType: "project",
				targetEntityId: projectId,
				payload,
			})),
		};
	},
};
