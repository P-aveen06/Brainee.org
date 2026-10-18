import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), operation: vi.fn() }));
vi.mock("@/lib/project-access", () => ({ assertProjectAccess: mocks.access }));
vi.mock("@/db/transport.server", () => ({ graphOperation: mocks.operation }));
import { proposeReusableBreakdownTool } from "./reusable-breakdown-tool";
import type { ToolContext } from "./tool-types";

const ctx = { user: { id: "employee" }, db: {} } as ToolContext;
const input = {
	destinationProjectId: "NEW",
	items: [
		{
			sourceProjectId: "OLD",
			sourceTaskId: "task",
			title: "Adapt checkout",
			description: "New purchase flow",
			matchedScope: "Same provider",
			scopeChanges: "New currency",
			assumptions: "Provider contract is stable",
			factor: 1.5,
			additionalHours: 2,
		},
	],
};
const result = () => ({
	scope: "company_delivery",
	sources: [],
	project: { id: "old", projectCode: "OLD" },
	rootTaskId: "task",
	tasks: {
		hasMore: false,
		items: [
			{
				id: "task",
				taskNumber: 1,
				isLeaf: true,
				estimateHours: 8,
				actualHours: 10,
			},
		],
	},
	estimateSummary: {
		estimatedHours: 8,
		actualHours: 10,
		missingLeafEstimates: 0,
		missingLeafActuals: 0,
	},
});

beforeEach(() => {
	vi.resetAllMocks();
	mocks.access.mockResolvedValue({ projectId: "new" });
	mocks.operation.mockResolvedValue(result());
});
describe("adapted editable task breakdown", () => {
	it("calculates effort from verified history and keeps immutable provenance in the proposal", async () => {
		const response = await proposeReusableBreakdownTool.execute(input, ctx);
		expect(response.proposedActions?.[0]).toMatchObject({
			actionType: "create_task",
			targetEntityId: "new",
			payload: {
				estimateHours: 17,
				sourceTaskId: "task",
				sourceProjectId: "old",
			},
		});
		expect(
			JSON.parse(
				String(response.proposedActions?.[0].payload.adaptationAssumptions),
			),
		).toMatchObject({ scopeChanges: "New currency" });
		expect(
			mocks.operation.mock.calls.every(
				([operation]) => operation === "delivery.context",
			),
		).toBe(true);
	});
	it("checks destination authorization before loading evidence", async () => {
		mocks.access.mockRejectedValue(new Error("Project not found"));
		await expect(
			proposeReusableBreakdownTool.execute(input, ctx),
		).rejects.toThrow();
		expect(mocks.operation).not.toHaveBeenCalled();
	});
	it("does not invent a total from an incomplete task family", async () => {
		const data = result();
		data.tasks.items[0].isLeaf = false;
		data.estimateSummary.missingLeafActuals = 1;
		data.estimateSummary.missingLeafEstimates = 1;
		mocks.operation.mockResolvedValue(data);
		const response = await proposeReusableBreakdownTool.execute(input, ctx);
		expect(response.proposedActions?.[0].payload.estimateHours).toBeNull();
	});
	it("does not attribute sibling effort to an intermediate task", async () => {
		const data = result();
		data.rootTaskId = "root";
		data.tasks.items[0].isLeaf = false;
		mocks.operation.mockResolvedValue(data);
		const response = await proposeReusableBreakdownTool.execute(input, ctx);
		expect(response.success).toBe(false);
		expect(response.proposedActions).toBeUndefined();
	});
});
