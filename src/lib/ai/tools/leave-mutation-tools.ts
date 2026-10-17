import { and, desc, eq, inArray } from "@/db/graph-query";
import { leaveRequests, systemLeaveTypes } from "@/db/schema";
import { getLeaveCancellationTargetStatus } from "@/lib/leave-policy";
import type { ToolHandler } from "./tool-types";

export const proposeLeaveCancellationTool: ToolHandler = {
	name: "propose_leave_cancellation",
	description:
		"Propose cancelling the authenticated user's pending or approved leave request. Pass a real ID when one was resolved; otherwise the latest cancellable request is selected and shown for human confirmation.",
	parameters: {
		type: "object",
		properties: {
			leaveRequestId: {
				type: "string",
				description: "A real leave request ID from get_my_leave_requests",
			},
		},
	},
	async execute(args, ctx) {
		const leaveRequestId = args.leaveRequestId
			? String(args.leaveRequestId)
			: undefined;
		const conditions = [eq(leaveRequests.userId, ctx.user.id)];
		if (leaveRequestId) {
			conditions.push(eq(leaveRequests.id, leaveRequestId));
		} else {
			conditions.push(inArray(leaveRequests.status, ["pending", "approved"]));
		}
		const [request] = await ctx.db
			.select({
				id: leaveRequests.id,
				leaveType: leaveRequests.leaveType,
				leaveTypeName: systemLeaveTypes.name,
				startDate: leaveRequests.startDate,
				endDate: leaveRequests.endDate,
				totalDays: leaveRequests.totalDays,
				status: leaveRequests.status,
			})
			.from(leaveRequests)
			.leftJoin(
				systemLeaveTypes,
				eq(systemLeaveTypes.slug, leaveRequests.leaveType),
			)
			.where(and(...conditions))
			.orderBy(desc(leaveRequests.createdAt))
			.limit(1);

		if (!request) return { success: false, error: "Leave request not found." };
		const targetStatus = getLeaveCancellationTargetStatus(request.status);
		if (!targetStatus) {
			return {
				success: false,
				error: `This ${request.status} leave request cannot be cancelled.`,
			};
		}

		const leaveTypeName = request.leaveTypeName || request.leaveType;
		return {
			success: true,
			data: {
				message: `Proposal created: Cancel ${leaveTypeName} from ${request.startDate} to ${request.endDate}.`,
				request: { ...request, leaveTypeName, targetStatus },
			},
			groundedRecordIds: [request.id],
			groundedLabels: [
				{
					id: request.id,
					label: `${leaveTypeName} ${request.startDate} to ${request.endDate}`,
				},
			],
			proposedAction: {
				actionType: "cancel_leave_request",
				targetEntityType: "leave_request",
				targetEntityId: request.id,
				payload: { leaveRequestId: request.id },
			},
		};
	},
};
