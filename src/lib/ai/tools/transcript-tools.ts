import { eq, or } from "drizzle-orm";
import { projects, projectTasks, users } from "@/db/schema";
import { assertProjectAccess } from "@/lib/project-access";
import {
	compareTranscriptClaims,
	parseTranscriptClaims,
	TRANSCRIPT_CATEGORIES,
} from "../transcript-comparison";
import type { ToolHandler } from "./tool-types";

export const compareProjectTranscriptTool: ToolHandler = {
	name: "compare_project_transcript",
	description:
		"Compare structured claims extracted from a meeting or call transcript with an accessible project's current dates, task statuses, and task owners. Use after resolving the project. Treat mismatches as review items, not proof that either source is correct.",
	parameters: {
		type: "object",
		properties: {
			projectId: {
				type: "string",
				description:
					"Resolved project ID or code (e.g. 'prj-001' or 'PRJ-001')",
			},
			claims: {
				type: "array",
				maxItems: 30,
				items: {
					type: "object",
					properties: {
						category: { type: "string", enum: [...TRANSCRIPT_CATEGORIES] },
						statement: { type: "string" },
						sourceTimestamp: { type: "string" },
						speaker: { type: "string" },
						taskQuery: {
							type: "string",
							description:
								"Task title or unique phrase when the claim concerns a task",
						},
						proposedDate: { type: "string" },
						proposedOwner: { type: "string" },
						proposedStatus: { type: "string" },
					},
					required: ["category", "statement"],
				},
			},
		},
		required: ["projectId", "claims"],
	},
	async execute(args, ctx) {
		const rawProjectId = String(args.projectId).trim();
		const [project] = await ctx.db
			.select({
				id: projects.id,
				name: projects.name,
				code: projects.code,
				status: projects.status,
				targetEndDate: projects.targetEndDate,
			})
			.from(projects)
			.where(
				or(
					eq(projects.id, rawProjectId),
					eq(projects.id, rawProjectId.toLowerCase()),
					eq(projects.code, rawProjectId),
					eq(projects.code, rawProjectId.toUpperCase()),
				),
			)
			.limit(1);

		if (!project) return { success: false, error: "Project not found." };

		try {
			await assertProjectAccess(ctx.db, ctx.user, project.id, "viewer");
		} catch {
			return { success: false, error: "Project not found." };
		}

		const claims = parseTranscriptClaims(args.claims);
		const tasks = await ctx.db
			.select({
				id: projectTasks.id,
				taskNumber: projectTasks.taskNumber,
				title: projectTasks.title,
				status: projectTasks.status,
				dueDate: projectTasks.dueDate,
				assigneeName: users.name,
			})
			.from(projectTasks)
			.leftJoin(users, eq(projectTasks.assigneeId, users.id))
			.where(eq(projectTasks.projectId, project.id))
			.limit(50);
		if (!project) return { success: false, error: "Project not found." };
		const findings = compareTranscriptClaims({ project, tasks, claims });
		const matchedIds = findings.flatMap((finding) =>
			finding.evidence?.id ? [finding.evidence.id] : [],
		);
		return {
			success: true,
			data: {
				project: { id: project.id, name: project.name },
				findings,
				summary: Object.fromEntries(
					[...new Set(findings.map((finding) => finding.status))].map(
						(status) => [
							status,
							findings.filter((finding) => finding.status === status).length,
						],
					),
				),
			},
			groundedRecordIds: [...new Set([project.id, ...matchedIds])],
			groundedLabels: [
				{ id: project.id, label: project.name },
				...tasks.map((task) => ({
					id: task.id,
					label: `#${task.taskNumber} ${task.title}`,
				})),
			],
		};
	},
};
