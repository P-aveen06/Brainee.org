import { z } from "zod";

const requestLeavePayload = z.object({
	leaveType: z.string().min(1),
	startDate: z.string().min(1),
	endDate: z.string().min(1),
	reason: z.string().optional(),
});

const cancelLeaveRequestPayload = z.object({
	leaveRequestId: z.string().min(1),
});

const updateTaskStatusPayload = z.object({
	newStatus: z.enum([
		"todo",
		"in_progress",
		"in_review",
		"done",
		"blocked",
		"cancelled",
	]),
	reason: z.string().optional(),
});

const createTaskPayload = z.object({
	projectId: z.string().min(1),
	title: z.string().trim().min(1).max(300),
	description: z.string().trim().max(10_000).optional().nullable(),
	priority: z.enum(["low", "medium", "high", "critical"]),
	stageKey: z.string().max(100).optional().nullable(),
	assigneeId: z.string().optional().nullable(),
	startDate: z.string().optional().nullable(),
	dueDate: z.string().optional().nullable(),
	estimateHours: z.number().min(0).max(100_000).optional().nullable(),
	sourceTaskId: z.string().min(1).optional(),
	sourceProjectId: z.string().min(1).optional(),
	adaptationAssumptions: z.string().max(10000).optional(),
});

const reportAssetIssuePayload = z.object({
	issueDescription: z.string().min(1),
});

export const proposedActionSchema = z.discriminatedUnion("actionType", [
	z.object({
		actionType: z.literal("request_leave"),
		payload: requestLeavePayload,
	}),
	z.object({
		actionType: z.literal("cancel_leave_request"),
		payload: cancelLeaveRequestPayload,
	}),
	z.object({
		actionType: z.literal("update_task_status"),
		payload: updateTaskStatusPayload,
	}),
	z.object({
		actionType: z.literal("create_task"),
		payload: createTaskPayload,
	}),
	z.object({
		actionType: z.literal("report_asset_issue"),
		payload: reportAssetIssuePayload,
	}),
]);

export function parseProposedAction(actionType: string, payload: unknown) {
	return proposedActionSchema.safeParse({ actionType, payload });
}
