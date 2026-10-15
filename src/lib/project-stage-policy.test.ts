import { describe, expect, it } from "vitest";
import {
	assessStageChecklist,
	type StageChecklistItemLike,
} from "./project-stage-policy";

describe("project-stage-policy", () => {
	it("allows advancement when stage has no checklist items", () => {
		const result = assessStageChecklist([]);
		expect(result.canAdvance).toBe(true);
		expect(result.unmetRequiredItems).toEqual([]);
		expect(result.totalCount).toBe(0);
		expect(result.completedCount).toBe(0);
		expect(result.percentComplete).toBe(100);
	});

	it("allows advancement when only optional items are pending", () => {
		const items: StageChecklistItemLike[] = [
			{
				id: "item-1",
				title: "Optional stakeholder interview",
				isRequired: false,
				status: "pending",
			},
			{
				id: "item-2",
				title: "Optional architecture review",
				isRequired: false,
				status: "done",
			},
		];

		const result = assessStageChecklist(items);
		expect(result.canAdvance).toBe(true);
		expect(result.unmetRequiredItems).toHaveLength(0);
		expect(result.totalCount).toBe(2);
		expect(result.completedCount).toBe(1);
		expect(result.percentComplete).toBe(50);
	});

	it("blocks advancement when any required item is pending and names the item", () => {
		const items: StageChecklistItemLike[] = [
			{
				id: "item-1",
				title: "Sign Master Services Agreement (MSA)",
				isRequired: true,
				status: "done",
			},
			{
				id: "item-2",
				title: "Security & SOC2 Audit Approval",
				isRequired: true,
				status: "pending",
			},
			{
				id: "item-3",
				title: "Optional meeting minutes",
				isRequired: false,
				status: "pending",
			},
		];

		const result = assessStageChecklist(items);
		expect(result.canAdvance).toBe(false);
		expect(result.unmetRequiredItems).toEqual([
			{ id: "item-2", title: "Security & SOC2 Audit Approval" },
		]);
		expect(result.requiredCount).toBe(2);
		expect(result.requiredMetCount).toBe(1);
	});

	it("treats 'not_applicable' status as satisfying required items", () => {
		const items: StageChecklistItemLike[] = [
			{
				id: "item-1",
				title: "Hardware procurement form",
				isRequired: true,
				status: "not_applicable", // Marked N/A for cloud-only project
			},
			{
				id: "item-2",
				title: "Client NDA countersignature",
				isRequired: true,
				status: "done",
			},
		];

		const result = assessStageChecklist(items);
		expect(result.canAdvance).toBe(true);
		expect(result.unmetRequiredItems).toHaveLength(0);
		expect(result.completedCount).toBe(2);
		expect(result.percentComplete).toBe(100);
	});

	it("correctly calculates completion percentages with mixed items", () => {
		const items: StageChecklistItemLike[] = [
			{ id: "1", title: "T1", isRequired: true, status: "done" },
			{ id: "2", title: "T2", isRequired: true, status: "pending" },
			{ id: "3", title: "T3", isRequired: false, status: "pending" },
		];

		const result = assessStageChecklist(items);
		// 1 of 3 complete = 33%
		expect(result.percentComplete).toBe(33);
		expect(result.canAdvance).toBe(false);
	});
});
