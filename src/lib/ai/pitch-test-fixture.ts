import { createPitch, type PitchTurnState } from "./pitch-types";

export function pitchFixture() {
	const state: PitchTurnState = {
		drafts: [],
		evidence: new Map([
			[
				"task-1",
				{
					id: "task-1",
					label: "ATLAS #1: Event ingestion",
					kind: "workspace",
					excerpt:
						"Implemented event ingestion with idempotent handling. Status: in_review. Business impact has not been measured.",
					projectIds: ["project-1"],
				},
			],
		]),
	};
	const input = {
		title: "Connected operations",
		audience: "Client business leaders",
		objective: "Demonstrate our team's relevant delivery experience.",
		sections: [
			{
				id: "atlas",
				kind: "case_study" as const,
				title: "Resilient event ingestion",
				slide:
					"Bring operational events into one reliable processing flow.\nIdempotent handling supports safe processing of repeated events.",
				document:
					"The team implemented event ingestion with idempotent handling. The work is currently in review. Business impact has not yet been measured; this example demonstrates implementation scope rather than a quantified outcome.",
				sourceIds: ["task-1"],
				gaps: [
					"Validate business impact and client disclosure before external use.",
				],
			},
		],
	};
	return { input, state, pitch: createPitch(input, state) };
}
