import { describe, expect, it } from "vitest";
import { compareTranscriptClaims } from "./transcript-comparison";

const project = {
	id: "project-1",
	name: "Unilever",
	status: "active",
	targetEndDate: "2026-10-16",
};
const tasks = [
	{
		id: "task-1",
		taskNumber: 4,
		title: "API migration",
		status: "in_progress",
		dueDate: "2026-10-16",
		assigneeName: "Sneha",
	},
];

describe("compareTranscriptClaims", () => {
	it("flags deadline mismatches as possible contradictions", () => {
		const [finding] = compareTranscriptClaims({
			project,
			tasks,
			referenceDateIso: "2026-10-16",
			claims: [
				{
					category: "deadline",
					statement: "API migration is due Oct 20, 2026",
					taskQuery: "API migration",
					proposedDate: "Oct 20, 2026",
				},
			],
		});
		expect(finding.status).toBe("possible_contradiction");
		expect(finding.reason).toContain("2026-10-16");
	});

	it("flags ownership changes without declaring either source correct", () => {
		const [finding] = compareTranscriptClaims({
			project,
			tasks,
			claims: [
				{
					category: "ownership",
					statement: "Rahul owns API migration",
					taskQuery: "API migration",
					proposedOwner: "Rahul",
				},
			],
		});
		expect(finding.status).toBe("possible_contradiction");
		expect(finding.evidence?.currentValue).toBe("Sneha");
	});

	it("reports new risks when no task matches", () => {
		const [finding] = compareTranscriptClaims({
			project,
			tasks,
			claims: [{ category: "risk", statement: "Certification blocks release" }],
		});
		expect(finding.status).toBe("new_information");
	});
});
