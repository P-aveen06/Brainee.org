import { parseAssistantQuestionSet } from "../assistant-questions";
import type { ToolHandler } from "./tool-types";

export const askQuestionsTool: ToolHandler = {
	name: "ask_questions",
	description:
		"Ask the user a small set of structured follow-up questions when required information is missing. Use only for details that block the requested work. Group related questions together, provide grounded options when available, and allow free-text answers for open-ended details. The assistant pauses and shows the questions inline in the chat.",
	parameters: {
		type: "object",
		properties: {
			questions: {
				type: "array",
				minItems: 1,
				maxItems: 5,
				items: {
					type: "object",
					properties: {
						id: { type: "string", description: "Stable question key" },
						prompt: {
							type: "string",
							description: "Question shown to the user",
						},
						type: {
							type: "string",
							enum: ["single_choice", "multiple_choice", "text"],
						},
						options: {
							type: "array",
							minItems: 2,
							maxItems: 7,
							items: {
								type: "object",
								properties: {
									id: { type: "string" },
									label: { type: "string" },
									description: { type: "string" },
								},
								required: ["id", "label"],
							},
						},
						allowOther: { type: "boolean" },
					},
					required: ["id", "prompt", "type"],
				},
			},
		},
		required: ["questions"],
	},
	async execute(args) {
		const questionSet = parseAssistantQuestionSet(args);
		if (!questionSet) {
			return { success: false, error: "Question request is invalid." };
		}
		return { success: true, data: { questions: questionSet.questions } };
	},
};
