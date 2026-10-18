import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "@/db/graph-query";
import { createDb } from "@/db";
import { aiProposedActions } from "@/db/schema";
import { parseProposedAction } from "@/lib/ai/proposed-actions";
import { createTaskCore } from "@/lib/project-task-create.server";
import { authMiddleware } from "@/lib/server-fn";
import {
	confirmProposalSchema,
	rejectProposalSchema,
} from "./ai-assistant-schema";
import { reportAssetIssueCore } from "./assets";
import { applyForLeaveCore } from "./leaves-apply.server";
import { cancelLeaveRequestCore } from "./leaves-cancel.server";
import { updateTaskStatusCore } from "./project-tasks-status";

export const confirmAiProposedAction = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => confirmProposalSchema.parse(data))
	.handler(async ({ data, context }) => {
		const db = createDb();

		const [prop] = await db
			.select()
			.from(aiProposedActions)
			.where(
				and(
					eq(aiProposedActions.id, data.proposalId),
					eq(aiProposedActions.userId, context.user.id),
				),
			)
			.limit(1);

		if (!prop) return { error: "Proposal not found." };

		// Recover stale executing proposals (> 60s since last update)
		if (prop.status === "executing") {
			const updatedAtMs = prop.updatedAt
				? new Date(prop.updatedAt).getTime()
				: 0;
			const isExpired =
				prop.expiresAt && new Date(prop.expiresAt).getTime() < Date.now();
			if (isExpired || Date.now() - updatedAtMs > 60_000) {
				const nextStatus = isExpired ? "expired" : "failed";
				await db
					.update(aiProposedActions)
					.set({ status: nextStatus, updatedAt: new Date() })
					.where(eq(aiProposedActions.id, prop.id));
				return {
					error: isExpired
						? "Proposal has expired (15 minute validity window exceeded)."
						: "Previous execution attempt timed out. Proposal marked as failed.",
				};
			}
			return {
				error: "Proposal is currently executing. Please wait a moment.",
			};
		}

		if (prop.status !== "pending") {
			return { error: `Proposal has already been ${prop.status}.` };
		}

		if (prop.expiresAt && new Date(prop.expiresAt).getTime() < Date.now()) {
			await db
				.update(aiProposedActions)
				.set({ status: "expired" })
				.where(eq(aiProposedActions.id, prop.id));
			return {
				error: "Proposal has expired (15 minute validity window exceeded).",
			};
		}

		let rawPayload: unknown = {};
		try {
			rawPayload = prop.payload ? JSON.parse(prop.payload) : {};
		} catch {
			return { error: "Proposal payload is invalid." };
		}
		if (data.edits) {
			if (prop.actionType !== "create_task") return { error: "Only task drafts can be edited." };
			rawPayload = { ...(rawPayload as Record<string, unknown>), ...data.edits };
		}
		const parsedAction = parseProposedAction(prop.actionType, rawPayload);
		if (!parsedAction.success) {
			return { error: "Proposal type or payload is not permitted." };
		}

		const [claimed] = await db
			.update(aiProposedActions)
			.set({ status: "executing", updatedAt: new Date(), payload: JSON.stringify(parsedAction.data.payload) })
			.where(
				and(
					eq(aiProposedActions.id, prop.id),
					eq(aiProposedActions.userId, context.user.id),
					eq(aiProposedActions.status, "pending"),
				),
			)
			.returning({ id: aiProposedActions.id });
		if (!claimed) return { error: "Proposal is no longer pending." };

		const action = parsedAction.data;

		// Every proposal type below executes through the exact same server function the
		// normal UI uses — the confirming user's own validation, authorization, and side
		// effects (notifications, audit trails) apply exactly as if they'd done it by hand.
		// There is no separate AI write path.

		let actionError: string | undefined;
		try {
			if (action.actionType === "update_task_status") {
				const payload = action.payload;
				const result = await updateTaskStatusCore(db, context.user, {
					id: prop.targetEntityId,
					status: payload.newStatus,
					blockedReason:
						payload.newStatus === "blocked" ? payload.reason : undefined,
				});
				if ("error" in result) actionError = result.error;
			} else if (action.actionType === "request_leave") {
				const payload = action.payload;
				const result = await applyForLeaveCore(db, context.user, {
					leave_type: payload.leaveType,
					start_date: payload.startDate,
					end_date: payload.endDate,
					start_day_portion: "full_day",
					end_day_portion: "full_day",
					reason: payload.reason,
				});
				if ("error" in result) actionError = result.error;
			} else if (action.actionType === "cancel_leave_request") {
				const result = await cancelLeaveRequestCore(
					db,
					context.user,
					action.payload.leaveRequestId,
				);
				if ("error" in result) actionError = result.error;
			} else if (action.actionType === "report_asset_issue") {
				const payload = action.payload;
				const result = await reportAssetIssueCore(db, context.user, {
					assignmentId: prop.targetEntityId,
					description: payload.issueDescription,
				});
				if ("error" in result) actionError = result.error;
			} else if (action.actionType === "create_task") {
				const payload = action.payload;
				await createTaskCore(db, context.user, {
					projectId: payload.projectId,
					title: payload.title,
					description: payload.description,
					priority: payload.priority,
					stageKey: payload.stageKey,
					assigneeId: payload.assigneeId,
					startDate: payload.startDate,
					dueDate: payload.dueDate,
					estimateHours: payload.estimateHours,
					sourceTaskId: payload.sourceTaskId,
					sourceProjectId: payload.sourceProjectId,
					adaptationAssumptions: payload.adaptationAssumptions,
				});
			}
		} catch (error) {
			console.error("AI proposal execution failed", error);
			actionError = "Action could not be completed.";
		}

		if (actionError) {
			await db
				.update(aiProposedActions)
				.set({ status: "failed", updatedAt: new Date() })
				.where(eq(aiProposedActions.id, prop.id));
			return { error: actionError };
		}

		await db
			.update(aiProposedActions)
			.set({
				status: "confirmed",
				confirmedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(aiProposedActions.id, prop.id));

		return { success: true, actionType: action.actionType };
	});

export const rejectAiProposedAction = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => rejectProposalSchema.parse(data))
	.handler(async ({ data, context }) => {
		const db = createDb();

		const [target] = await db
			.select({
				id: aiProposedActions.id,
				status: aiProposedActions.status,
				updatedAt: aiProposedActions.updatedAt,
			})
			.from(aiProposedActions)
			.where(
				and(
					eq(aiProposedActions.id, data.proposalId),
					eq(aiProposedActions.userId, context.user.id),
				),
			)
			.limit(1);

		if (!target) return { error: "Proposal not found." };
		const isStaleExecuting =
			target.status === "executing" &&
			Date.now() -
				(target.updatedAt ? new Date(target.updatedAt).getTime() : 0) >
				60_000;
		if (target.status !== "pending" && !isStaleExecuting) {
			return {
				error: `Proposal cannot be rejected (current status: ${target.status}).`,
			};
		}

		const [rejected] = await db
			.update(aiProposedActions)
			.set({
				status: "rejected",
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(aiProposedActions.id, target.id),
					eq(aiProposedActions.status, target.status),
				),
			)
			.returning({ id: aiProposedActions.id });

		if (!rejected) {
			return {
				error: "Proposal could not be rejected because its status changed.",
			};
		}

		return { success: true };
	});
