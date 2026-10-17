import { and, count, eq, inArray } from "@/db/graph-query";
import type { Database } from "../db";
import { leaveRequests, users, wfhRequests } from "../db/schema";

export const ACTIONABLE_LEAVE_APPROVAL_STATUSES = [
	"pending",
	"pending_cancellation",
] as const;
export const ACTIONABLE_WFH_APPROVAL_STATUSES = [
	"pending",
	"pending_cancellation",
] as const;

type ApprovalCountActor = {
	id: string;
	role: string;
};

export type ApprovalCountScope =
	| { kind: "all" }
	| { kind: "direct-reports"; leadId: string };

export function resolveApprovalCountScope(
	actor: ApprovalCountActor,
): ApprovalCountScope | null {
	if (actor.role === "admin") return { kind: "all" };
	if (actor.role === "lead") {
		return { kind: "direct-reports", leadId: actor.id };
	}
	return null;
}

export async function getPendingApprovalCount(
	db: Database,
	actor: ApprovalCountActor,
) {
	const scope = resolveApprovalCountScope(actor);
	if (!scope) return 0;

	const employeeScope =
		scope.kind === "direct-reports"
			? and(
					eq(users.isOnboarded, true),
					eq(users.isActive, true),
					eq(users.peerLeadId, scope.leadId),
				)
			: and(eq(users.isOnboarded, true), eq(users.isActive, true));

	const [leaveCount, wfhCount] = await Promise.all([
		db
			.select({ value: count() })
			.from(leaveRequests)
			.innerJoin(users, eq(leaveRequests.userId, users.id))
			.where(
				and(
					inArray(leaveRequests.status, ACTIONABLE_LEAVE_APPROVAL_STATUSES),
					employeeScope,
				),
			),
		db
			.select({ value: count() })
			.from(wfhRequests)
			.innerJoin(users, eq(wfhRequests.userId, users.id))
			.where(
				and(
					inArray(wfhRequests.status, ACTIONABLE_WFH_APPROVAL_STATUSES),
					employeeScope,
				),
			),
	]);

	return Number(leaveCount[0]?.value ?? 0) + Number(wfhCount[0]?.value ?? 0);
}
