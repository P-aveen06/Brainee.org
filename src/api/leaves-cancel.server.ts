import { and, eq, or } from "drizzle-orm";
import type { Database } from "@/db";
import { leaveRequests } from "@/db/schema";
import { formatDateDisplay } from "@/lib/date-format";
import { getLeaveCancellationTargetStatus } from "@/lib/leave-policy";
import { notifyApprovers } from "@/lib/notifications.server";
import type { AppUser } from "@/lib/server-fn";

export async function cancelLeaveRequestCore(
	db: Database,
	user: AppUser,
	id: string,
) {
	const trimmedId = id.trim();
	const [request] = await db
		.select()
		.from(leaveRequests)
		.where(
			and(
				or(
					eq(leaveRequests.id, trimmedId),
					eq(leaveRequests.startDate, trimmedId),
				),
				eq(leaveRequests.userId, user.id),
			),
		)
		.limit(1);

	if (!request) return { error: "Leave request not found." };

	const nextStatus = getLeaveCancellationTargetStatus(request.status);
	if (!nextStatus) {
		return {
			error: "Cannot cancel a request that is not pending or approved.",
		};
	}

	const [updatedRequest] = await db
		.update(leaveRequests)
		.set({ status: nextStatus, updatedAt: new Date() })
		.where(
			and(
				eq(leaveRequests.id, request.id),
				eq(leaveRequests.userId, user.id),
				eq(leaveRequests.status, request.status),
			),
		)
		.returning({ id: leaveRequests.id });

	if (!updatedRequest) {
		return {
			error:
				"This leave request changed while cancellation was being submitted. Refresh and try again.",
		};
	}

	const displayStart = formatDateDisplay(request.startDate);
	const displayEnd = formatDateDisplay(request.endDate);
	const requesterName = user.name ?? "A team member";
	const isPending = request.status === "pending";
	const requestSummary = isPending
		? `${requesterName} cancelled their ${request.leaveType} leave request from ${displayStart} to ${displayEnd} (${request.totalDays} day${request.totalDays === 1 ? "" : "s"}).`
		: `${requesterName} requested cancellation for their approved ${request.leaveType} leave from ${displayStart} to ${displayEnd} (${request.totalDays} day${request.totalDays === 1 ? "" : "s"}).`;
	const reasonLine = request.reason
		? `Original reason: ${request.reason}`
		: "Original reason: Not provided";

	await notifyApprovers(db, {
		requesterId: user.id,
		type: "leave_cancelled",
		title: isPending
			? `Leave request cancelled by ${requesterName}`
			: `Leave cancellation requested by ${requesterName}`,
		body: isPending ? `${requestSummary} ${reasonLine}` : requestSummary,
		relatedId: request.id,
		relatedType: "leave_request",
		actionUrl: "/approvals",
		emailSubject: isPending
			? `Leave cancelled: ${requesterName} (${displayStart} to ${displayEnd})`
			: `Leave Cancellation Requested: ${requesterName} (${displayStart} to ${displayEnd})`,
		emailBody: [
			requestSummary,
			...(isPending ? [reasonLine, "", "No action is required."] : []),
		].join("\n"),
	});

	return { success: true, status: nextStatus };
}
