import { addIsoDays } from "@/lib/leave-policy";
import type {
	AssistantChartSpec,
	AssistantChartView,
	ScopedAssistantChart,
} from "../chart-types";
import type { ToolHandler } from "./tool-types";
import { loadWorkBrief } from "./work-brief-data";

const chartViews: AssistantChartView[] = [
	"project_health",
	"projects_by_stage",
	"projects_by_client",
	"delivery_risks",
	"team_availability",
];

function labelFor(value: string): string {
	return value
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupedChart(
	chart: Omit<AssistantChartSpec, "categories" | "series">,
	counts: Map<string, number>,
	seriesName: string,
): AssistantChartSpec {
	const entries = [...counts].sort((a, b) => b[1] - a[1]);
	const visible = entries.slice(0, 14);
	if (entries.length > visible.length) {
		visible.push([
			"Other",
			entries.slice(14).reduce((total, [, count]) => total + count, 0),
		]);
	}
	return {
		...chart,
		categories: visible.map(([category]) => category),
		series: [{ name: seriesName, values: visible.map(([, count]) => count) }],
	};
}

function countChart(
	view: AssistantChartView,
	brief: Awaited<ReturnType<typeof loadWorkBrief>>,
): AssistantChartSpec | undefined {
	const scope =
		brief.visibleIds === "all"
			? "Company-wide projects"
			: "Projects you can access";
	if (view === "project_health") {
		const counts = new Map([
			["On track", 0],
			["At risk", 0],
			["Off track", 0],
			["Unrated", 0],
		]);
		if (brief.portfolio.length === 0) return undefined;
		for (const project of brief.portfolio) {
			const value = (project.health || "green").toLowerCase();
			const category = ["green", "healthy", "on_track"].includes(value)
				? "On track"
				: ["amber", "yellow", "warning", "at_risk"].includes(value)
					? "At risk"
					: ["red", "critical", "off_track"].includes(value)
						? "Off track"
						: "Unrated";
			counts.set(category, (counts.get(category) ?? 0) + 1);
		}
		const entries = [...counts].filter(([, count]) => count > 0);
		return {
			type: "donut",
			title: "Project health",
			scope,
			asOf: brief.today,
			categories: entries.map(([category]) => category),
			series: [{ name: "Projects", values: entries.map(([, count]) => count) }],
		};
	}

	if (view === "projects_by_stage") {
		const counts = new Map<string, number>();
		for (const project of brief.portfolio) {
			const stage = project.stage ? labelFor(project.stage) : "Unstaged";
			counts.set(stage, (counts.get(stage) ?? 0) + 1);
		}
		if (counts.size === 0) return undefined;
		return groupedChart(
			{ type: "bar", title: "Projects by stage", scope, asOf: brief.today },
			counts,
			"Projects",
		);
	}

	if (view === "projects_by_client") {
		const counts = new Map<string, number>();
		for (const project of brief.portfolio) {
			if (project.projectType !== "client") continue;
			const client = project.client || "Client not recorded";
			counts.set(client, (counts.get(client) ?? 0) + 1);
		}
		if (counts.size === 0) return undefined;
		return groupedChart(
			{
				type: "bar",
				title: "Client projects by client",
				scope,
				asOf: brief.today,
			},
			counts,
			"Projects",
		);
	}

	if (view === "delivery_risks") {
		const openTasks = brief.tasks.filter(
			(task) => task.status !== "done" && task.status !== "cancelled",
		);
		const counts = new Map<string, { overdue: number; blocked: number }>();
		for (const project of brief.portfolio) {
			counts.set(project.id, { overdue: 0, blocked: 0 });
		}
		for (const task of openTasks) {
			const projectCounts = counts.get(task.projectId);
			if (!projectCounts) continue;
			if (task.dueDate && task.dueDate < brief.today)
				projectCounts.overdue += 1;
			if (task.status === "blocked") projectCounts.blocked += 1;
		}
		const projectsById = new Map(
			brief.portfolio.map((project) => [project.id, project]),
		);
		const entries = [...counts].flatMap(([projectId, values]) => {
			const project = projectsById.get(projectId);
			return project && (values.overdue > 0 || values.blocked > 0)
				? [{ label: project.code, ...values }]
				: [];
		});
		entries.sort((a, b) => b.overdue + b.blocked - a.overdue - a.blocked);
		if (entries.length === 0) return undefined;
		const visible = entries.slice(0, 12).map((item) => ({ ...item }));
		if (entries.length > visible.length) {
			visible.push({
				label: "Other projects",
				overdue: entries
					.slice(12)
					.reduce((sum, entry) => sum + entry.overdue, 0),
				blocked: entries
					.slice(12)
					.reduce((sum, entry) => sum + entry.blocked, 0),
			});
		}
		return {
			type: "bar",
			title: "Overdue and blocked tasks by project",
			scope,
			asOf: brief.today,
			categories: visible.map((item) => item.label),
			series: [
				{ name: "Overdue", values: visible.map((item) => item.overdue) },
				{ name: "Blocked", values: visible.map((item) => item.blocked) },
			],
			note: "A task may be both overdue and blocked.",
		};
	}

	const dates = Array.from({ length: 7 }, (_, index) =>
		addIsoDays(brief.today, index),
	);
	const leaveCounts = dates.map(() => new Set<string>());
	const wfhCounts = dates.map(() => new Set<string>());
	for (const leave of brief.leaves) {
		for (const [index, date] of dates.entries()) {
			if (leave.startDate <= date && leave.endDate >= date) {
				leaveCounts[index].add(leave.userId);
			}
		}
	}
	for (const wfh of brief.wfhs) {
		const index = dates.indexOf(wfh.date);
		if (index >= 0) wfhCounts[index].add(wfh.userId);
	}
	return {
		type: "line",
		title: "Approved leave and WFH",
		scope: brief.organizationScope
			? "Company-wide team, next 7 days"
			: "Your project team and direct reports, next 7 days",
		asOf: brief.today,
		categories: dates,
		series: [
			{ name: "On leave", values: leaveCounts.map((users) => users.size) },
			{ name: "WFH approved", values: wfhCounts.map((users) => users.size) },
		],
		note: "Counts are per approval type and may overlap.",
	};
}

export const getChartTool: ToolHandler = {
	name: "get_chart",
	description:
		"Create a visual from permission-scoped workspace records when it will make a comparison or trend clearer. Choose a supported view: project health distribution, projects by stage, client project counts, overdue and blocked tasks by project, or approved leave and WFH over the next 7 days. The server computes all chart values; never provide or infer the data yourself.",
	parameters: {
		type: "object",
		properties: {
			view: {
				type: "string",
				enum: chartViews,
				description:
					"The supported workspace chart view that best answers the question.",
			},
		},
		required: ["view"],
	},
	async execute(args, ctx) {
		const view = args.view;
		if (
			typeof view !== "string" ||
			!chartViews.includes(view as AssistantChartView)
		) {
			return {
				success: false,
				error: "Choose one of the supported chart views.",
			};
		}
		const brief = await loadWorkBrief(ctx);
		if (
			(view !== "team_availability" && brief.portfolio.length === 100) ||
			(view === "delivery_risks" && brief.tasks.length === 500) ||
			(view === "team_availability" && brief.members.length === 500)
		) {
			return {
				success: false,
				error:
					"The scoped dataset reached its retrieval limit, so I can't make a complete chart.",
			};
		}
		const chart = countChart(view as AssistantChartView, brief);
		if (!chart) {
			const emptyMessages: Record<AssistantChartView, string> = {
				project_health: "There are no projects in the current scope to chart.",
				projects_by_stage:
					"There are no projects in the current scope to chart.",
				projects_by_client:
					"There are no client projects in the current scope to chart.",
				delivery_risks:
					"There are no overdue or blocked open tasks in the current scope to chart.",
				team_availability:
					"Availability data is unavailable for the current scope.",
			};
			return {
				success: false,
				error: emptyMessages[view as AssistantChartView],
			};
		}
		const scopedChart: ScopedAssistantChart = {
			chart,
			scopeProjectIds: brief.projectIds,
			scopeUserIds:
				view === "team_availability"
					? brief.relevantPeople.map((person) => person.id)
					: [],
		};
		return {
			success: true,
			data: { chart },
			chart: scopedChart,
			groundedRecordIds: [
				...brief.projectIds,
				...(view === "delivery_risks"
					? brief.tasks.map((task) => task.id)
					: []),
				...(view === "team_availability"
					? [...brief.leaves, ...brief.wfhs].map((item) => item.id)
					: []),
			],
			groundedLabels: brief.portfolio.map((project) => ({
				id: project.id,
				label: project.code,
			})),
		};
	},
};
