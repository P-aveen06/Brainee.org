import { describe, expect, it } from "vitest";
import { confirmProposalSchema } from "@/api/ai-assistant-schema";

describe("task draft confirmation", () => {
	it("permits unknown effort while rejecting replacement provenance or project", () => {
		const input = {
			proposalId: "proposal",
			edits: {
				title: "Updated scope",
				description: "Revised assumptions",
				estimateHours: null,
			},
		};
		expect(confirmProposalSchema.safeParse(input).success).toBe(true);
		for (const field of [
			"sourceTaskId",
			"sourceProjectId",
			"projectId",
			"adaptationAssumptions",
		]) {
			expect(
				confirmProposalSchema.safeParse({
					...input,
					edits: { ...input.edits, [field]: "replacement" },
				}).success,
			).toBe(false);
		}
	});
});
