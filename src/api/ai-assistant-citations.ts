import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { graphOperation } from "@/db/transport.server";
import { authMiddleware } from "@/lib/server-fn";
import { parseDeliveryResult } from "../../shared/delivery-knowledge";

const taskCitationInput = z.object({
	projectCode: z.string().trim().min(1).max(100),
	taskId: z.string().trim().min(1).max(200),
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function taskReference(task: Record<string, unknown>): string {
	const number =
		typeof task.taskNumber === "number" ? `#${task.taskNumber} ` : "";
	const title = typeof task.title === "string" ? task.title : "Untitled task";
	const status = typeof task.status === "string" ? ` (${task.status})` : "";
	return `${number}${title}${status}`;
}

function formatTaskDescription(task: Record<string, unknown>): string | null {
	const details = [
		typeof task.title === "string" ? `Task: ${task.title}` : undefined,
		typeof task.status === "string" ? `Status: ${task.status}` : undefined,
		typeof task.priority === "string"
			? `Priority: ${task.priority}`
			: undefined,
		typeof task.assigneeName === "string"
			? `Owner: ${task.assigneeName}`
			: undefined,
		typeof task.dueDate === "string" ? `Due: ${task.dueDate}` : undefined,
		typeof task.description === "string" && task.description.trim()
			? `Description: ${task.description.trim()}`
			: undefined,
		typeof task.blockedReason === "string" && task.blockedReason.trim()
			? `Blocker: ${task.blockedReason.trim()}`
			: undefined,
		typeof task.estimateHours === "number"
			? `Estimate: ${task.estimateHours} hours`
			: undefined,
		typeof task.actualHours === "number"
			? `Logged: ${task.actualHours} hours`
			: undefined,
	].filter((value): value is string => Boolean(value));
	return details.length ? details.join("\n") : null;
}

function toRelatedTask(
	task: Record<string, unknown>,
	relation: "Parent task" | "Subtask",
	projectId: string | undefined,
) {
	if (typeof task.id !== "string") return null;
	return {
		id: task.id,
		projectId: typeof task.projectId === "string" ? task.projectId : projectId,
		relation,
		label: taskReference(task),
	};
}

/** Resolve task details only for the authenticated viewer and the current source record. */
export const getTaskCitationDetails = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => taskCitationInput.parse(data))
	.handler(async ({ data }) => {
		const result = parseDeliveryResult(
			await graphOperation("delivery.context", {
				projectId: data.projectCode,
				taskId: data.taskId,
				section: "tasks",
				limit: 100,
			}),
		);
		const taskPage = result.tasks;
		const items =
			isRecord(taskPage) && Array.isArray(taskPage.items)
				? taskPage.items.filter(isRecord)
				: [];
		const task = items.find((item) => item.id === data.taskId);
		const project = isRecord(result.project) ? result.project : undefined;
		const projectId = typeof project?.id === "string" ? project.id : undefined;
		const parent =
			task && typeof task.parentTaskId === "string"
				? items.find((candidate) => candidate.id === task.parentTaskId)
				: undefined;
		const allSubtasks = task
			? items.filter((candidate) => candidate.parentTaskId === task.id)
			: [];
		const subtasks = allSubtasks
			.slice(0, 6)
			.map((candidate) => toRelatedTask(candidate, "Subtask", projectId))
			.filter((candidate) => candidate !== null);
		const relatedTasks = [
			parent ? toRelatedTask(parent, "Parent task", projectId) : null,
			...subtasks,
		].filter((candidate) => candidate !== null);
		return {
			description: task ? formatTaskDescription(task) : null,
			relatedTasks,
			relatedTasksRemaining: Math.max(0, allSubtasks.length - subtasks.length),
		};
	});
