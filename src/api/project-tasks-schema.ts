import { z } from "zod";

export const taskStatusEnum = z.enum([
	"todo",
	"in_progress",
	"blocked",
	"in_review",
	"done",
	"cancelled",
]);

export const taskPriorityEnum = z.enum(["low", "medium", "high", "critical"]);

export const getProjectTasksSchema = z.object({
	projectId: z.string(),
	status: z.string().optional(),
	priority: z.string().optional(),
	stageKey: z.string().optional(),
	assigneeId: z.string().optional(),
	q: z.string().optional(),
	limit: z.number().min(1).max(500).default(500),
});

export const createTaskSchema = z.object({
	projectId: z.string(),
	title: z.string().min(1, "Task title is required"),
	description: z.string().optional().nullable(),
	priority: taskPriorityEnum.default("medium"),
	stageKey: z.string().optional().nullable(),
	assigneeId: z.string().optional().nullable(),
	startDate: z.string().optional().nullable(),
	dueDate: z.string().optional().nullable(),
	estimateHours: z.number().min(0).optional().nullable(),
	parentTaskId: z.string().optional().nullable(),
});

export const updateTaskSchema = z
	.object({
		id: z.string().optional(),
		taskId: z.string().optional(),
		projectId: z.string().optional(),
		title: z.string().min(1).optional(),
		description: z.string().optional().nullable(),
		priority: taskPriorityEnum.optional(),
		stageKey: z.string().optional().nullable(),
		assigneeId: z.string().optional().nullable(),
		startDate: z.string().optional().nullable(),
		dueDate: z.string().optional().nullable(),
		estimateHours: z.number().min(0).optional().nullable(),
		actualHours: z.number().min(0).optional().nullable(),
		parentTaskId: z.string().optional().nullable(),
	})
	.refine((d) => d.id || d.taskId, { message: "Task ID is required" });

export const updateTaskStatusSchema = z
	.object({
		id: z.string().optional(),
		taskId: z.string().optional(),
		projectId: z.string().optional(),
		status: taskStatusEnum,
		blockedReason: z.string().optional().nullable(),
	})
	.refine((d) => d.id || d.taskId, { message: "Task ID is required" });

export const reassignTaskSchema = z
	.object({
		id: z.string().optional(),
		taskId: z.string().optional(),
		projectId: z.string().optional(),
		newAssigneeId: z.string().optional().nullable(),
	})
	.refine((d) => d.id || d.taskId, { message: "Task ID is required" });

export const bulkReassignTasksSchema = z.object({
	projectId: z.string(),
	fromUserId: z.string(),
	toUserId: z.string().optional().nullable(),
	statusFilter: z.array(taskStatusEnum).optional(),
});

export const deleteTaskSchema = z
	.object({
		id: z.string().optional(),
		taskId: z.string().optional(),
		projectId: z.string().optional(),
	})
	.refine((d) => d.id || d.taskId, { message: "Task ID is required" });
