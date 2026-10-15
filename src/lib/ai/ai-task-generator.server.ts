import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { projectTasks } from "@/db/schema";
import { getEnvVar } from "@/lib/auth.server";
import { createTaskCore } from "@/lib/project-task-create.server";
import type { AppUser } from "@/lib/server-fn";
import { AzureDeepSeekProvider } from "./providers/azure-deepseek";
import { OpenRouterProvider } from "./providers/openrouter";

export interface GeneratedTaskResult {
	id: string;
	taskNumber: number;
	title: string;
	status: "todo" | "in_progress" | "done" | "blocked";
	note?: string;
}

import { type ExtractionPayload, heuristicExtract } from "./ai-task-heuristic";

export type { ExtractionPayload };

/**
 * Uses DeepSeek or Gemini via OpenRouter to analyze the developer's daily work summary
 * and extract one or more distinct, professional tasks (not combining unrelated items).
 */
export async function extractTasksWithAi(
	summary: string,
	blockers?: string | null,
): Promise<ExtractionPayload[]> {
	const deepseekKey =
		getEnvVar("DEEPSEEK_API_KEY") || getEnvVar("AZURE_DEEPSEEK_API_KEY") || "";
	const openRouterKey = getEnvVar("OPENROUTER_API_KEY");

	if (!deepseekKey && !openRouterKey) {
		return heuristicExtract(summary, blockers);
	}

	const prompt = `You are an expert software project manager. A software engineer has submitted the following daily work summary:

Work summary:
"${summary}"

${blockers ? `Blockers reported:\n"${blockers}"\n` : ""}

Analyze the work summary carefully:
- If the engineer describes multiple distinct accomplishments, features, or bug fixes (e.g. "worked on login page, fixed home page bugs, and tested download feature"), split them into separate discrete tasks. DO NOT combine multiple unrelated accomplishments into one single combined task.
- If only a single task is described, return just that one task.
- For each task, extract:
  - "title": Concise, professional, action-oriented title under 75 characters (e.g. "Develop login page", "Fix homepage bugs", "Test download feature").
  - "status": "done", "in_progress", or "blocked" (mark as "blocked" if blockers affect it, "in_progress" if currently in progress or investigating, or "done" if completed/fixed/tested/worked on).
  - "description": Brief context or detail if applicable.

Format your response strictly as JSON with NO markdown wrapping:
{
  "tasks": [
    { "title": "...", "status": "done" | "in_progress" | "blocked", "description": "..." }
  ]
}`;

	try {
		const provider = deepseekKey
			? new AzureDeepSeekProvider(
					deepseekKey,
					getEnvVar("AZURE_DEEPSEEK_ENDPOINT") ||
						"https://open-model-resource.openai.azure.com/openai/v1",
					getEnvVar("AZURE_DEEPSEEK_MODEL") || "DeepSeek-V4-Flash",
				)
			: new OpenRouterProvider(openRouterKey || "", "google/gemini-2.5-flash");

		const res = await provider.complete({
			system:
				"You are an expert software project manager. Output strictly valid JSON without markdown fences.",
			messages: [{ role: "user", content: prompt }],
			maxTokens: 400,
		});

		if (res.text) {
			const cleanJson = res.text
				.replace(/```json/gi, "")
				.replace(/```/g, "")
				.trim();
			const parsed = JSON.parse(cleanJson);

			if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
				const tasks: ExtractionPayload[] = parsed.tasks
					.map(
						(t: { title?: string; status?: string; description?: string }) => {
							const validStatus = [
								"todo",
								"in_progress",
								"done",
								"blocked",
							].includes(t.status || "")
								? (t.status as ExtractionPayload["status"])
								: "done";
							return {
								title: String(t.title || "").trim(),
								status: validStatus,
								description: t.description ? String(t.description) : undefined,
							};
						},
					)
					.filter((t: ExtractionPayload) => t.title.length > 0);

				if (tasks.length > 0) {
					return tasks;
				}
			} else if (parsed.title) {
				const validStatus = ["todo", "in_progress", "done", "blocked"].includes(
					parsed.status,
				)
					? (parsed.status as ExtractionPayload["status"])
					: "done";
				return [
					{
						title: String(parsed.title).trim(),
						status: validStatus,
						description: parsed.description || summary,
					},
				];
			}
		}
	} catch (err) {
		console.warn("AI task extraction fallback triggered:", err);
	}

	return heuristicExtract(summary, blockers);
}

/**
 * Convenience wrapper returning the first extracted task (maintains backwards compatibility).
 */
export async function extractTaskWithAi(
	summary: string,
	blockers?: string | null,
): Promise<ExtractionPayload> {
	const tasks = await extractTasksWithAi(summary, blockers);
	return (
		tasks[0] || {
			title: summary.slice(0, 75),
			status: "done",
			description: summary,
		}
	);
}

/**
 * Generates and persists a task from a daily standup update summary,
 * assigns it to the user, and records the completion date if done.
 */
export async function generateAndCreateTaskFromSummary(
	db: Database,
	user: AppUser,
	input: {
		projectId: string;
		summary: string;
		blockers?: string | null;
		date: string;
		hoursSpent?: number | null;
	},
): Promise<GeneratedTaskResult> {
	const extracted = await extractTaskWithAi(input.summary, input.blockers);

	// Create task in DB
	await createTaskCore(db, user, {
		projectId: input.projectId,
		title: extracted.title,
		description: extracted.description || input.summary,
		priority: "medium",
		assigneeId: user.id,
		estimateHours: input.hoursSpent ?? undefined,
	});

	// Retrieve the created task (highest taskNumber for this project)
	const [created] = await db
		.select({
			id: projectTasks.id,
			taskNumber: projectTasks.taskNumber,
			title: projectTasks.title,
			status: projectTasks.status,
		})
		.from(projectTasks)
		.where(
			and(
				eq(projectTasks.projectId, input.projectId),
				eq(projectTasks.createdById, user.id),
			),
		)
		.orderBy(desc(projectTasks.createdAt))
		.limit(1);

	if (!created) {
		throw new Error("Failed to retrieve created task.");
	}

	// Update status and completedAt if done or blocked
	const isDone = extracted.status === "done";
	const isBlocked = extracted.status === "blocked";
	const completedAt = isDone ? new Date() : null;
	const blockedReason = isBlocked
		? input.blockers?.trim() || "Blocked as reported in daily update"
		: null;

	await db
		.update(projectTasks)
		.set({
			status: extracted.status,
			completedAt,
			blockedReason,
			updatedAt: new Date(),
		})
		.where(eq(projectTasks.id, created.id));

	return {
		id: created.id,
		taskNumber: created.taskNumber,
		title: created.title,
		status: extracted.status,
		note: input.summary,
	};
}

/**
 * Creates a task that has already been reviewed/confirmed by the user.
 */
export async function persistConfirmedTask(
	db: Database,
	user: AppUser,
	input: {
		projectId: string;
		title: string;
		status: "todo" | "in_progress" | "done" | "blocked";
		description?: string | null;
		date?: string;
		hoursSpent?: number | null;
	},
): Promise<GeneratedTaskResult> {
	await createTaskCore(db, user, {
		projectId: input.projectId,
		title: input.title.trim(),
		description: input.description?.trim() || input.title.trim(),
		priority: "medium",
		assigneeId: user.id,
		estimateHours: input.hoursSpent ?? undefined,
	});

	const [created] = await db
		.select({
			id: projectTasks.id,
			taskNumber: projectTasks.taskNumber,
			title: projectTasks.title,
			status: projectTasks.status,
		})
		.from(projectTasks)
		.where(
			and(
				eq(projectTasks.projectId, input.projectId),
				eq(projectTasks.createdById, user.id),
			),
		)
		.orderBy(desc(projectTasks.createdAt))
		.limit(1);

	if (!created) {
		throw new Error("Failed to retrieve created task.");
	}

	const isDone = input.status === "done";
	const completedAt = isDone ? new Date() : null;

	await db
		.update(projectTasks)
		.set({
			status: input.status,
			completedAt,
			updatedAt: new Date(),
		})
		.where(eq(projectTasks.id, created.id));

	return {
		id: created.id,
		taskNumber: created.taskNumber,
		title: input.title.trim(),
		status: input.status,
		note: input.description || input.title.trim(),
	};
}
