import { describe, expect, it } from "vitest";
import { adaptEstimate } from "./adapted-estimate";
describe("adapt historical effort", () => {
	it("keeps missing effort unknown even with a known added component", () => {
		expect(
			adaptEstimate({
				estimateHours: null,
				actualHours: null,
				factor: 2,
				additionalHours: 4,
				complete: false,
			}),
		).toMatchObject({
			proposedHours: null,
			confidence: "limited",
			baselineSource: "unknown",
		});
	});
	it("separates historical actual from changed scope and preserves zero", () => {
		expect(
			adaptEstimate({
				estimateHours: 8,
				actualHours: 10,
				factor: 1.5,
				additionalHours: 2,
				complete: true,
			}),
		).toMatchObject({
			historicalEstimate: 8,
			historicalActual: 10,
			proposedHours: 17,
			confidence: "supported",
		});
		expect(
			adaptEstimate({
				estimateHours: 8,
				actualHours: 0,
				factor: 1,
				additionalHours: 0,
				complete: true,
			}).proposedHours,
		).toBe(0);
	});
});
