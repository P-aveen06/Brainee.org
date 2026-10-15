import { aliasedTable, desc, eq } from "drizzle-orm";
import type { Database } from "../db";
import { leaveRequests, users, wfhRequests } from "../db/schema";

export type ApprovalRequestItem = {
	id: string;
	type: "leave" | "wfh";
	status: string;
	employeeName: string;
	avatarUrl?: string;
	avatar_url?: string;
	leaveType?: string;
	startDate: string;
	endDate?: string;
	totalDays?: number;
	reason?: string | null;
	createdAt: string;
	actionedByName?: string;
	actionedAt?: string;
	decisionReason?: string | null;
	ruleViolationNote?: string | null;
	/** False once the requester has left; their pending items stop being actionable. */
	requesterIsActive: boolean;
};

export function isActionableApprovalStatus(status: string) {
	return status === "pending" || status === "pending_cancellation";
}

/**
 * When `leadId` is set, only requests from that lead's direct reports are
 * returned (leads act only on their own reports; admins see everything).
 */
export async function getApprovalsLiveData(
	db: Database,
	{ leadId }: { leadId?: string } = {},
) {
	const requester = aliasedTable(users, "requester");
	const approver = aliasedTable(users, "approver");
	const rejecter = aliasedTable(users, "rejecter");
	const revoker = aliasedTable(users, "revoker");

	const leaveRequestsData = await db
		.select({
			id: leaveRequests.id,
			status: leaveRequests.status,
			leaveType: leaveRequests.leaveType,
			startDate: leaveRequests.startDate,
			endDate: leaveRequests.endDate,
			totalDays: leaveRequests.totalDays,
			reason: leaveRequests.reason,
			createdAt: leaveRequests.createdAt,
			updatedAt: leaveRequests.updatedAt,
			rejectionReason: leaveRequests.rejectionReason,
			revokeReason: leaveRequests.revokeReason,
			employeeName: requester.name,
			requesterIsActive: requester.isActive,
			avatarUrl: requester.avatarUrl,
			approvedByName: approver.name,
			rejectedByName: rejecter.name,
			revokedByName: revoker.name,
		})
		.from(leaveRequests)
		.leftJoin(requester, eq(leaveRequests.userId, requester.id))
		.leftJoin(approver, eq(leaveRequests.approvedBy, approver.id))
		.leftJoin(rejecter, eq(leaveRequests.rejectedBy, rejecter.id))
		.leftJoin(revoker, eq(leaveRequests.revokedBy, revoker.id))
		.where(leadId ? eq(requester.peerLeadId, leadId) : undefined)
		.orderBy(desc(leaveRequests.createdAt))
		.limit(50);

	const wfhRequestsData = await db
		.select({
			id: wfhRequests.id,
			status: wfhRequests.status,
			date: wfhRequests.date,
			reason: wfhRequests.reason,
			createdAt: wfhRequests.createdAt,
			updatedAt: wfhRequests.updatedAt,
			rejectionReason: wfhRequests.rejectionReason,
			revokeReason: wfhRequests.revokeReason,
			employeeName: requester.name,
			requesterIsActive: requester.isActive,
			avatarUrl: requester.avatarUrl,
			approvedByName: approver.name,
			rejectedByName: rejecter.name,
			revokedByName: revoker.name,
		})
		.from(wfhRequests)
		.leftJoin(requester, eq(wfhRequests.userId, requester.id))
		.leftJoin(approver, eq(wfhRequests.approvedBy, approver.id))
		.leftJoin(rejecter, eq(wfhRequests.rejectedBy, rejecter.id))
		.leftJoin(revoker, eq(wfhRequests.revokedBy, revoker.id))
		.where(leadId ? eq(requester.peerLeadId, leadId) : undefined)
		.orderBy(desc(wfhRequests.createdAt))
		.limit(50);

	const allRequests: ApprovalRequestItem[] = [
		...leaveRequestsData.map((leave) => {
			const actionedByName =
				leave.status === "approved"
					? leave.approvedByName
					: leave.status === "rejected"
						? leave.rejectedByName
						: leave.status === "revoked"
							? leave.revokedByName
							: undefined;

			return {
				id: leave.id,
				type: "leave" as const,
				status: leave.status,
				employeeName: leave.employeeName ?? "Unknown",
				requesterIsActive: leave.requesterIsActive ?? false,
				avatarUrl: leave.avatarUrl ?? undefined,
				avatar_url: leave.avatarUrl ?? undefined,
				leaveType: leave.leaveType,
				startDate: leave.startDate,
				endDate: leave.endDate,
				totalDays: leave.totalDays,
				reason: leave.reason,
				createdAt: leave.createdAt ? leave.createdAt.toISOString() : "",
				actionedByName: actionedByName ?? undefined,
				actionedAt: leave.updatedAt ? leave.updatedAt.toISOString() : undefined,
				decisionReason: leave.rejectionReason ?? leave.revokeReason,
				ruleViolationNote: null, // not recomputed for history
			};
		}),
		...wfhRequestsData.map((wfh) => {
			const actionedByName =
				wfh.status === "approved"
					? wfh.approvedByName
					: wfh.status === "rejected"
						? wfh.rejectedByName
						: wfh.status === "revoked"
							? wfh.revokedByName
							: undefined;

			return {
				id: wfh.id,
				type: "wfh" as const,
				status: wfh.status,
				employeeName: wfh.employeeName ?? "Unknown",
				requesterIsActive: wfh.requesterIsActive ?? false,
				avatarUrl: wfh.avatarUrl ?? undefined,
				avatar_url: wfh.avatarUrl ?? undefined,
				startDate: wfh.date,
				reason: wfh.reason,
				createdAt: wfh.createdAt ? wfh.createdAt.toISOString() : "",
				actionedByName: actionedByName ?? undefined,
				actionedAt: wfh.updatedAt ? wfh.updatedAt.toISOString() : undefined,
				decisionReason: wfh.rejectionReason ?? wfh.revokeReason,
			};
		}),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	return {
		// A departed employee's outstanding requests are moot — they would
		// otherwise sit in an approver's queue forever. History keeps them.
		pending: allRequests.filter(
			(request) =>
				isActionableApprovalStatus(request.status) && request.requesterIsActive,
		),
		history: allRequests.filter(
			(request) => !isActionableApprovalStatus(request.status),
		),
	};
}
