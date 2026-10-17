import type { ThreadMessage } from "@assistant-ui/react";
import { callerPersona } from "@/lib/ai/persona-context";

export const STARTER_PROMPTS = [
	{
		title: "Projects & tasks",
		label: "Find overdue work and blockers",
		prompt:
			"What tasks are overdue, blocked, or need immediate attention across my projects?",
	},
	{
		title: "Daily standup",
		label: "Draft an update from my work",
		prompt:
			"Review my active tasks and logged hours today, and draft a concise standup update.",
	},
	{
		title: "Leave & WFH",
		label: "Check my remaining balances",
		prompt:
			"What are my remaining leave balances and WFH allowance for this cycle?",
	},
	{
		title: "Team availability",
		label: "See who's away this week",
		prompt: "Who is on leave or working remotely this week?",
	},
];

export function getStarterPrompts(user: { role: string; authId?: string }) {
	const persona = callerPersona(user);
	if (persona === "employee")
		return [
			{
				title: "Start my day",
				label: "Priorities across my projects",
				prompt:
					"Brief me on my assigned work, overdue tasks, and blockers. What should I focus on today?",
			},
			STARTER_PROMPTS[1],
			STARTER_PROMPTS[2],
			{
				title: "My equipment",
				label: "Review my assigned hardware",
				prompt:
					"Show the equipment assigned to me and any upcoming warranty or return dates.",
			},
		];
	const brief = {
		ceo: {
			title: "Executive briefing",
			label: "Delivery, client risk, and capacity",
			prompt:
				"Give me an executive briefing across the company: internal versus client projects, delivery risks, blockers, and decisions that need my attention. Suggest the next three actions.",
		},
		lead: {
			title: "My delivery briefing",
			label: "My projects and immediate risks",
			prompt:
				"Brief me on my projects: overdue work, blockers, owners, and the next delivery actions I should take.",
		},
		architect: {
			title: "Architecture briefing",
			label: "Technical risks across projects",
			prompt:
				"Review my projects for architecture and integration risks. Show recorded blockers, relevant technical decisions, and reviews that need my attention.",
		},
		hr: {
			title: "People briefing",
			label: "Staffing, reporting, and coverage",
			prompt:
				"Give me a people briefing: headcount, reporting lines, and planned absences that need coverage this week.",
		},
	}[persona];
	if (persona === "hr")
		return [
			brief,
			STARTER_PROMPTS[3],
			{
				title: "Reporting lines",
				label: "Leads and their direct reports",
				prompt: "Who are the project leads, and who reports to each of them?",
			},
			STARTER_PROMPTS[2],
		];
	if (persona === "architect")
		return [
			brief,
			{
				title: "My architecture reviews",
				label: "Due dates and review priorities",
				prompt:
					"Show my architecture review tasks across all my projects, ordered by due date and priority.",
			},
			{
				title: "Integration blockers",
				label: "Dependencies needing a decision",
				prompt:
					"Which integration dependencies are blocking my projects, who owns each blocker, and what recorded decision or next action would unblock delivery?",
			},
			STARTER_PROMPTS[3],
		];
	if (persona === "lead")
		return [
			brief,
			{
				title: "My approvals",
				label: "Requests from my direct reports",
				prompt:
					"Show the pending leave and WFH approvals from my direct reports.",
			},
			{
				title: "Update coverage",
				label: "Follow up on missing daily updates",
				prompt:
					"Which teammates have not submitted a daily update in my projects today? Show the projects and names.",
			},
			STARTER_PROMPTS[3],
		];
	return [
		brief,
		{
			title: "Client commitments",
			label: "At-risk client delivery",
			prompt:
				"Which client projects need attention and what recorded blockers threaten their delivery dates?",
		},
		{
			title: "Staffing overview",
			label: "Allocation across visible projects",
			prompt:
				"Summarize project staffing and allocation across the company. Flag recorded allocation conflicts and state any missing capacity evidence.",
		},
		{
			title: "Internal investment",
			label: "Progress on internal initiatives",
			prompt:
				"Summarize the internal projects, their owners, current stages, and immediate risks.",
		},
	];
}

const FOLLOW_UPS = {
	leave: [
		"Show my pending leave requests",
		"What is my remaining leave balance?",
		"Who is away next week?",
	],
	work: [
		"Which tasks are overdue?",
		"Show blocked tasks across my projects",
		"Summarize my active projects",
	],
	assets: [
		"Show equipment assigned to me",
		"Are any of my assets due for return?",
		"Show my pending asset requests",
	],
	general: [
		"Summarize my active projects",
		"Who is away this week?",
		"Show my tasks due this week",
	],
};

/** Relevant shortcuts without an extra model request or unsupported data claims. */
export function getFollowUpSuggestions(
	messages: readonly ThreadMessage[],
): string[] {
	const last = messages.at(-1);
	if (!last || last.role !== "assistant" || last.status?.type !== "complete")
		return [];
	const answer = last.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("");
	if (!answer.trim() || answer.trimStart().startsWith("⚠️")) return [];
	const userMessages = messages.filter((message) => message.role === "user");
	const questions = userMessages.map((message) =>
		message.content
			.filter((part) => part.type === "text")
			.map((part) => part.text)
			.join("")
			.toLowerCase()
			.trim(),
	);
	const query = questions.at(-1) ?? "";
	const group =
		/\b(leave|leaves|wfh|away|remote|balance|balances|availability)\b/.test(
			query,
		)
			? "leave"
			: /\b(task|tasks|project|projects|standup|blocked|overdue)\b/.test(query)
				? "work"
				: /\b(asset|assets|equipment|hardware|laptop)\b/.test(query)
					? "assets"
					: "general";
	return FOLLOW_UPS[group]
		.filter((prompt) => !questions.includes(prompt.toLowerCase()))
		.slice(0, 3);
}
