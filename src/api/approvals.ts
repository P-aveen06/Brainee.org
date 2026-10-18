import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray } from "@/db/graph-query";
import { z } from "zod";
import { createDb, type Database } from "../db";
import { leaveRequests, users, wfhRequests } from "../db/schema";
import { getApprovalsLiveData } from "../lib/approvals-live-data.server";
import { logAuditEvent } from "../lib/audit.server";
import { formatDateDisplay } from "../lib/date-format";
import { ensureBalancesForCycle } from "../lib/leave-balances.server";
import { getLeaveCycleBounds } from "../lib/leave-policy";
import { createNotification } from "../lib/notifications.server";
import {
	AppError,
	type AppUser,
	adminMiddleware,
	approverMiddleware,
	authMiddleware,
	toClientError,
} from "../lib/server-fn";
import { getTeamCalendarLiveData } from "../lib/team-calendar-live-data.server";

const rejectionSchema = z.object({
	id: z.string(),
	reason: z
		.string()
		.trim()
		.min(1, "A reason is required for rejection.")
		.max(500),
});

/**
 * Admins can act on anyone's request; leads only on their direct reports.
 * This also blocks self-approval for leads (nobody is their own lead).
 */
async function assertCanActOn(
	db: Database,
	actor: AppUser,
	requesterId: string,
) {
	if (actor.role === "admin") return;

	const [requester] = await db
		.select({ peerLeadId: users.peerLeadId })
		.from(users)
		.where(eq(users.id, requesterId))
		.limit(1);

	if (!requester || requester.peerLeadId !== actor.id) {
		throw new AppError(
			"You can only act on requests from your direct reports.",
		);
	}
}

/** Notification + audit must never fail (or roll back) an already-applied decision. */
async function runSideEffects(label: string, effects: () => Promise<void>) {
	try {
		await effects();
	} catch (err) {
		console.error(`${label}: side effects failed`, err);
	}
}

function dateAtMidnight(isoDate: string) {
	return new Date(`${isoDate}T00:00:00`);
}

export const approveLeaveRequest = createServerFn({ method: "POST" })
	.middleware([approverMiddleware])
	.inputValidator((data: unknown) => z.string().parse(data))
	.handler(async ({ data: id, context }) => {
		try {
			const actor = context.user;
			const db = createDb();

			const [request] = await db
				.select({
					id: leaveRequests.id,
					userId: leaveRequests.userId,
					leaveType: leaveRequests.leaveType,
					startDate: leaveRequests.startDate,
					endDate: leaveRequests.endDate,
					totalDays: leaveRequests.totalDays,
					reason: leaveRequests.reason,
					employeeBirthday: users.birthday,
					employeeJoinDate: users.joinDate,
				})
				.from(leaveRequests)
				.leftJoin(users, eq(leaveRequests.userId, users.id))
				.where(
					and(eq(leaveRequests.id, id), eq(leaveRequests.status, "pending")),
				)
				.limit(1);

			if (!request) {
				return { error: "Request not found or already processed." };
			}

			await assertCanActOn(db, actor, request.userId);

			if (!request.employeeBirthday) {
				return { error: "Employee birthday not set." };
			}

			// The leave consumes the allowance of the cycle it starts in.
			const cycle = await ensureBalancesForCycle(
				db,
				{
					id: request.userId,
					birthday: request.employeeBirthday,
					joinDate: request.employeeJoinDate,
				},
				dateAtMidnight(request.startDate),
			);
			if (!cycle) {
				return { error: "Leave balance is not configured." };
			}

			const flipped = await db.operation<{ id: string }[]>("leave.approve", {
				id,
				cycleStart: cycle.cycleStart,
			});

			if (flipped.length === 0) {
				const [current] = await db
					.select({ status: leaveRequests.status })
					.from(leaveRequests)
					.where(eq(leaveRequests.id, id))
					.limit(1);
				if (current?.status === "pending") {
					return { error: "Insufficient leave balance for this request." };
				}
				return { error: "Request not found or already processed." };
			}

			await runSideEffects("approveLeaveRequest", async () => {
				const actorName = actor.name ?? "Your lead";
				const displayStart = formatDateDisplay(request.startDate);
				const displayEnd = formatDateDisplay(request.endDate);
				const body = `Your ${request.leaveType} leave from ${displayStart} to ${displayEnd} has been approved by ${actorName}.`;

				await createNotification(db, {
					userId: request.userId,
					type: "leave_approved",
					title: "Leave approved",
					body,
					relatedId: id,
					relatedType: "leave_request",
					actionUrl: "/calendar",
					emailSubject: `Leave approved by ${actorName}`,
					emailBody: [
						body,
						request.reason ? `Reason you gave: ${request.reason}` : "",
						"",
						"You can view the updated request in Brainee.org.",
					]
						.filter(Boolean)
						.join("\n"),
				});

				await logAuditEvent(db, {
					actorId: actor.id,
					action: "approve_leave",
					entityType: "leave_request",
					entityId: id,
					oldData: { status: "pending" },
					newData: { status: "approved", approvedBy: actor.id },
				});
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to approve request.");
		}
	});

export const rejectLeaveRequest = createServerFn({ method: "POST" })
	.middleware([approverMiddleware])
	.inputValidator((data: unknown) => rejectionSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const actor = context.user;
			const db = createDb();

			const [request] = await db
				.select()
				.from(leaveRequests)
				.where(
					and(
						eq(leaveRequests.id, input.id),
						eq(leaveRequests.status, "pending"),
					),
				)
				.limit(1);

			if (!request) {
				return { error: "Request not found or already processed." };
			}

			await assertCanActOn(db, actor, request.userId);

			const flipped = await db
				.update(leaveRequests)
				.set({
					status: "rejected",
					rejectedBy: actor.id,
					rejectionReason: input.reason,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(leaveRequests.id, input.id),
						eq(leaveRequests.status, "pending"),
					),
				)
				.returning({ id: leaveRequests.id });

			if (flipped.length === 0) {
				return { error: "Request not found or already processed." };
			}

			await runSideEffects("rejectLeaveRequest", async () => {
				const actorName = actor.name ?? "Your lead";
				const displayStart = formatDateDisplay(request.startDate);
				const displayEnd = formatDateDisplay(request.endDate);
				const body = `Your ${request.leaveType} leave from ${displayStart} to ${displayEnd} was rejected by ${actorName}. Reason: ${input.reason}`;

				await createNotification(db, {
					userId: request.userId,
					type: "leave_rejected",
					title: "Leave rejected",
					body,
					relatedId: input.id,
					relatedType: "leave_request",
					actionUrl: "/calendar",
					emailSubject: `Leave rejected by ${actorName}`,
					emailBody: [
						body,
						request.reason ? `Reason you gave: ${request.reason}` : "",
						"",
						"You can view the updated request in Brainee.org.",
					]
						.filter(Boolean)
						.join("\n"),
				});

				await logAuditEvent(db, {
					actorId: actor.id,
					action: "reject_leave",
					entityType: "leave_request",
					entityId: input.id,
					oldData: { status: "pending" },
					newData: { status: "rejected", rejectionReason: input.reason },
				});
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to reject request.");
		}
	});

export const revokeLeaveRequest = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => rejectionSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const actor = context.user;
			const db = createDb();

			const [request] = await db
				.select({
					id: leaveRequests.id,
					userId: leaveRequests.userId,
					leaveType: leaveRequests.leaveType,
					startDate: leaveRequests.startDate,
					endDate: leaveRequests.endDate,
					totalDays: leaveRequests.totalDays,
					reason: leaveRequests.reason,
					status: leaveRequests.status,
					employeeBirthday: users.birthday,
				})
				.from(leaveRequests)
				.leftJoin(users, eq(leaveRequests.userId, users.id))
				.where(
					and(
						eq(leaveRequests.id, input.id),
						inArray(leaveRequests.status, ["approved", "pending_cancellation"]),
					),
				)
				.limit(1);

			if (!request) {
				return { error: "Approved request not found." };
			}

			const cycle = request.employeeBirthday
				? getLeaveCycleBounds(
						request.employeeBirthday,
						dateAtMidnight(request.startDate),
					)
				: null;
			const flipped = await db.operation<{ id: string }[]>("leave.revoke", {
				id: input.id,
				reason: input.reason,
				cycleStart: cycle?.cycleStart ?? "",
			});
			if (!flipped.length) return { error: "Approved request not found." };

			await runSideEffects("revokeLeaveRequest", async () => {
				const actorName = actor.name ?? "An admin";
				const displayStart = formatDateDisplay(request.startDate);
				const displayEnd = formatDateDisplay(request.endDate);
				const body = `Your approved ${request.leaveType} leave from ${displayStart} to ${displayEnd} has been revoked by ${actorName}. Reason: ${input.reason}`;

				await createNotification(db, {
					userId: request.userId,
					type: "leave_revoked",
					title: "Leave revoked",
					body,
					relatedId: input.id,
					relatedType: "leave_request",
					actionUrl: "/calendar",
					emailSubject: `Leave revoked by ${actorName}`,
					emailBody: [
						body,
						request.reason ? `Reason you gave: ${request.reason}` : "",
						"",
						"You can view the updated request in Brainee.org.",
					]
						.filter(Boolean)
						.join("\n"),
				});

				await logAuditEvent(db, {
					actorId: actor.id,
					action: "revoke_leave",
					entityType: "leave_request",
					entityId: input.id,
					oldData: { status: request.status },
					newData: { status: "revoked", revokeReason: input.reason },
				});
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to revoke request.");
		}
	});

export const rejectLeaveCancellation = createServerFn({ method: "POST" })
	.middleware([approverMiddleware])
	.inputValidator((data: unknown) => rejectionSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const actor = context.user;
			const db = createDb();

			const [request] = await db
				.select()
				.from(leaveRequests)
				.where(
					and(
						eq(leaveRequests.id, input.id),
						eq(leaveRequests.status, "pending_cancellation"),
					),
				)
				.limit(1);

			if (!request) {
				return { error: "Cancellation request not found." };
			}

			await assertCanActOn(db, actor, request.userId);

			const flipped = await db
				.update(leaveRequests)
				.set({
					status: "approved",
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(leaveRequests.id, input.id),
						eq(leaveRequests.status, "pending_cancellation"),
					),
				)
				.returning({ id: leaveRequests.id });

			if (flipped.length === 0) {
				return { error: "Cancellation request not found." };
			}

			await runSideEffects("rejectLeaveCancellation", async () => {
				const actorName = actor.name ?? "Your lead";
				const displayStart = formatDateDisplay(request.startDate);
				const displayEnd = formatDateDisplay(request.endDate);
				const body = `Your request to cancel approved leave from ${displayStart} to ${displayEnd} was declined by ${actorName}. Reason: ${input.reason}`;

				await createNotification(db, {
					userId: request.userId,
					type: "leave_approved",
					title: "Cancellation request declined",
					body,
					relatedId: input.id,
					relatedType: "leave_request",
					actionUrl: "/calendar",
					emailSubject: `Leave Cancellation Declined: ${actorName}`,
					emailBody: [
						body,
						"",
						"Your approved leave remains active. You can view details in Brainee.org.",
					].join("\n"),
				});

				await logAuditEvent(db, {
					actorId: actor.id,
					action: "reject_cancellation",
					entityType: "leave_request",
					entityId: input.id,
					oldData: { status: "pending_cancellation" },
					newData: { status: "approved", rejectionReason: input.reason },
				});
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to reject cancellation.");
		}
	});

export const approveWfhRequest = createServerFn({ method: "POST" })
	.middleware([approverMiddleware])
	.inputValidator((data: unknown) => z.string().parse(data))
	.handler(async ({ data: id, context }) => {
		try {
			const actor = context.user;
			const db = createDb();

			const [request] = await db
				.select()
				.from(wfhRequests)
				.where(and(eq(wfhRequests.id, id), eq(wfhRequests.status, "pending")))
				.limit(1);

			if (!request) {
				return { error: "Request not found or already processed." };
			}

			await assertCanActOn(db, actor, request.userId);

			const flipped = await db
				.update(wfhRequests)
				.set({
					status: "approved",
					approvedBy: actor.id,
					updatedAt: new Date(),
				})
				.where(and(eq(wfhRequests.id, id), eq(wfhRequests.status, "pending")))
				.returning({ id: wfhRequests.id });

			if (flipped.length === 0) {
				return { error: "Request not found or already processed." };
			}

			await runSideEffects("approveWfhRequest", async () => {
				const actorName = actor.name ?? "Your lead";
				const displayDate = formatDateDisplay(request.date);
				const body = `Your WFH request for ${displayDate} has been approved by ${actorName}.`;

				await createNotification(db, {
					userId: request.userId,
					type: "wfh_approved",
					title: "WFH approved",
					body,
					relatedId: id,
					relatedType: "wfh_request",
					actionUrl: "/calendar",
					emailSubject: `WFH approved by ${actorName}`,
					emailBody: [
						body,
						request.reason ? `Reason you gave: ${request.reason}` : "",
						"",
						"You can view the updated request in Brainee.org.",
					]
						.filter(Boolean)
						.join("\n"),
				});

				await logAuditEvent(db, {
					actorId: actor.id,
					action: "approve_wfh",
					entityType: "wfh_request",
					entityId: id,
					oldData: { status: "pending" },
					newData: { status: "approved" },
				});
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to approve WFH request.");
		}
	});

export const rejectWfhRequest = createServerFn({ method: "POST" })
	.middleware([approverMiddleware])
	.inputValidator((data: unknown) => rejectionSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const actor = context.user;
			const db = createDb();

			const [request] = await db
				.select()
				.from(wfhRequests)
				.where(
					and(eq(wfhRequests.id, input.id), eq(wfhRequests.status, "pending")),
				)
				.limit(1);

			if (!request) {
				return { error: "Request not found or already processed." };
			}

			await assertCanActOn(db, actor, request.userId);

			const flipped = await db
				.update(wfhRequests)
				.set({
					status: "rejected",
					rejectedBy: actor.id,
					rejectionReason: input.reason,
					updatedAt: new Date(),
				})
				.where(
					and(eq(wfhRequests.id, input.id), eq(wfhRequests.status, "pending")),
				)
				.returning({ id: wfhRequests.id });

			if (flipped.length === 0) {
				return { error: "Request not found or already processed." };
			}

			await runSideEffects("rejectWfhRequest", async () => {
				const actorName = actor.name ?? "Your lead";
				const displayDate = formatDateDisplay(request.date);
				const body = `Your WFH request for ${displayDate} was rejected by ${actorName}. Reason: ${input.reason}`;

				await createNotification(db, {
					userId: request.userId,
					type: "wfh_rejected",
					title: "WFH rejected",
					body,
					relatedId: input.id,
					relatedType: "wfh_request",
					actionUrl: "/calendar",
					emailSubject: `WFH rejected by ${actorName}`,
					emailBody: [
						body,
						request.reason ? `Reason you gave: ${request.reason}` : "",
						"",
						"You can view the updated request in Brainee.org.",
					]
						.filter(Boolean)
						.join("\n"),
				});

				await logAuditEvent(db, {
					actorId: actor.id,
					action: "reject_wfh",
					entityType: "wfh_request",
					entityId: input.id,
					oldData: { status: "pending" },
					newData: { status: "rejected", rejectionReason: input.reason },
				});
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to reject WFH request.");
		}
	});

export const revokeWfhRequest = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => rejectionSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const actor = context.user;
			const db = createDb();

			const [request] = await db
				.select()
				.from(wfhRequests)
				.where(
					and(
						eq(wfhRequests.id, input.id),
						inArray(wfhRequests.status, ["approved", "pending_cancellation"]),
					),
				)
				.limit(1);

			if (!request) {
				return { error: "Approved request not found." };
			}

			const flipped = await db
				.update(wfhRequests)
				.set({
					status: "revoked",
					revokedBy: actor.id,
					revokeReason: input.reason,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(wfhRequests.id, input.id),
						inArray(wfhRequests.status, ["approved", "pending_cancellation"]),
					),
				)
				.returning({ id: wfhRequests.id });

			if (flipped.length === 0) {
				return { error: "Approved request not found." };
			}

			await runSideEffects("revokeWfhRequest", async () => {
				const actorName = actor.name ?? "An admin";
				const displayDate = formatDateDisplay(request.date);
				const body = `Your approved WFH request for ${displayDate} has been revoked by ${actorName}. Reason: ${input.reason}`;

				await createNotification(db, {
					userId: request.userId,
					type: "wfh_revoked",
					title: "WFH revoked",
					body,
					relatedId: input.id,
					relatedType: "wfh_request",
					actionUrl: "/calendar",
					emailSubject: `WFH revoked by ${actorName}`,
					emailBody: [
						body,
						request.reason ? `Reason you gave: ${request.reason}` : "",
						"",
						"You can view the updated request in Brainee.org.",
					]
						.filter(Boolean)
						.join("\n"),
				});

				await logAuditEvent(db, {
					actorId: actor.id,
					action: "revoke_wfh",
					entityType: "wfh_request",
					entityId: input.id,
					oldData: { status: "approved" },
					newData: { status: "revoked", revokeReason: input.reason },
				});
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to revoke WFH request.");
		}
	});

export const rejectWfhCancellation = createServerFn({ method: "POST" })
	.middleware([approverMiddleware])
	.inputValidator((data: unknown) => rejectionSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const actor = context.user;
			const db = createDb();

			const [request] = await db
				.select()
				.from(wfhRequests)
				.where(
					and(
						eq(wfhRequests.id, input.id),
						eq(wfhRequests.status, "pending_cancellation"),
					),
				)
				.limit(1);

			if (!request) {
				return { error: "Cancellation request not found." };
			}

			await assertCanActOn(db, actor, request.userId);

			const flipped = await db
				.update(wfhRequests)
				.set({
					status: "approved",
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(wfhRequests.id, input.id),
						eq(wfhRequests.status, "pending_cancellation"),
					),
				)
				.returning({ id: wfhRequests.id });

			if (flipped.length === 0) {
				return { error: "Cancellation request not found." };
			}

			await runSideEffects("rejectWfhCancellation", async () => {
				const actorName = actor.name ?? "Your lead";
				const displayDate = formatDateDisplay(request.date);
				const body = `Your request to cancel approved WFH for ${displayDate} was declined by ${actorName}. Reason: ${input.reason}`;

				await createNotification(db, {
					userId: request.userId,
					type: "wfh_approved",
					title: "WFH cancellation request declined",
					body,
					relatedId: input.id,
					relatedType: "wfh_request",
					actionUrl: "/calendar",
					emailSubject: `WFH Cancellation Declined: ${actorName}`,
					emailBody: [
						body,
						"",
						"Your approved WFH remains active. You can view details in Brainee.org.",
					].join("\n"),
				});

				await logAuditEvent(db, {
					actorId: actor.id,
					action: "reject_wfh_cancellation",
					entityType: "wfh_request",
					entityId: input.id,
					oldData: { status: "pending_cancellation" },
					newData: { status: "approved", rejectionReason: input.reason },
				});
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to reject WFH cancellation.");
		}
	});

export const getApprovalsLive = createServerFn({ method: "GET" })
	.middleware([approverMiddleware])
	.handler(async ({ context }) => {
		const db = createDb();
		const leadId = context.user.role === "admin" ? undefined : context.user.id;
		return await getApprovalsLiveData(db, { leadId });
	});

// Visible to every signed-in employee (intentional: the whole team can see
// the team calendar).
export const getTeamCalendarLive = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => z.string().parse(data))
	.handler(async ({ data: dateStr }) => {
		const db = createDb();
		const date = new Date(dateStr);
		return await getTeamCalendarLiveData(db, date);
	});
