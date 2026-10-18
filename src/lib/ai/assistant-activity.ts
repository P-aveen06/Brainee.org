export const ASSISTANT_ACTIVITY_LABELS = {
	preparing: "Preparing your request",
	analyzing: "Understanding your question",
	searching: "Checking relevant company records",
	drafting: "Preparing a suggested action",
	reviewing: "Reviewing the findings",
	answering: "Writing your answer",
} as const;

export type AssistantActivity = keyof typeof ASSISTANT_ACTIVITY_LABELS;

export function isAssistantActivity(
	value: unknown,
): value is AssistantActivity {
	return (
		typeof value === "string" && Object.hasOwn(ASSISTANT_ACTIVITY_LABELS, value)
	);
}
