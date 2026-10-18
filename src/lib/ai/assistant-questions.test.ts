import { describe, expect, it } from "vitest";
import { parseAssistantQuestionSet } from "./assistant-questions";

describe("parseAssistantQuestionSet", () => {
	it("preserves a grounded suggestion for an open text question", () => {
		const parsed = parseAssistantQuestionSet({
			questions: [
				{
					id: "scope",
					prompt: "What should this task include?",
					type: "text",
					suggestedAnswer: "Reuse the existing project access patterns.",
				},
			],
		});

		expect(parsed?.questions[0]?.suggestedAnswer).toBe(
			"Reuse the existing project access patterns.",
		);
	});

	it("omits missing or oversized suggestions without rejecting the question", () => {
		const parsed = parseAssistantQuestionSet({
			questions: [
				{
					id: "scope",
					prompt: "What should this task include?",
					type: "text",
					suggestedAnswer: "x".repeat(1201),
				},
			],
		});

		expect(parsed?.questions[0]).not.toHaveProperty("suggestedAnswer");
	});
});
