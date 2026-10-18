export const ASSISTANT_ACTIVITY_LABELS = {
	preparing: "Preparing your request",
	analyzing: "Understanding your question",
	searching: "Checking relevant company records",
	drafting: "Preparing a suggested action",
	reviewing: "Reviewing the findings",
	answering: "Writing your answer",
} as const;

export type AssistantActivity = keyof typeof ASSISTANT_ACTIVITY_LABELS;

export const ASSISTANT_TOOL_STEP_LABELS = {
	projects: "Reviewing project information",
	team: "Checking team information",
	requests: "Reviewing requests and availability",
	research: "Researching public guidance",
	pitch: "Preparing your pitch and case studies",
	layout: "Checking the pitch layout",
	proposal: "Preparing a suggested update",
	clarification: "Clarifying what you need",
	workspace: "Checking relevant workspace information",
} as const;

export type AssistantToolStep = keyof typeof ASSISTANT_TOOL_STEP_LABELS;
export type AssistantToolProgress = {
	step: AssistantToolStep;
	status: "queued" | "running" | "complete" | "failed";
};

export function getAssistantToolStep(toolName: string): AssistantToolStep {
	if (toolName === "search_pitch_references" || toolName === "read_public_page")
		return "research";
	if (toolName === "present_pitch_package") return "pitch";
	if (toolName === "inspect_pitch_layout") return "layout";
	if (toolName === "ask_questions") return "clarification";
	if (toolName.startsWith("propose_")) return "proposal";
	if (/leave|approval|asset|availability|timesheet/i.test(toolName))
		return "requests";
	if (/team|employee|reporting|workload|daily|eod|work_brief/i.test(toolName))
		return "team";
	if (
		/project|portfolio|delivery|document|transcript|task|checklist|decision/i.test(
			toolName,
		)
	)
		return "projects";
	return "workspace";
}

export function isAssistantToolProgress(
	value: unknown,
): value is AssistantToolProgress {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const progress = value as Record<string, unknown>;
	return (
		typeof progress.step === "string" &&
		Object.hasOwn(ASSISTANT_TOOL_STEP_LABELS, progress.step) &&
		(progress.status === "queued" ||
			progress.status === "running" ||
			progress.status === "complete" ||
			progress.status === "failed")
	);
}

export function isAssistantActivity(
	value: unknown,
): value is AssistantActivity {
	return (
		typeof value === "string" && Object.hasOwn(ASSISTANT_ACTIVITY_LABELS, value)
	);
}
