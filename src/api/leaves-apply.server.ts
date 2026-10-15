import { z } from "zod";
import type { Database } from "../db";
import { leaveRequests, systemLeaveTypes } from "../db/schema";
import { resolveLeaveType } from "../lib/ai/normalization/leave-type";
import { formatDateDisplay } from "../lib/date-format";
import { validateLeaveRequest } from "../lib/leave-validation.server";
import { notifyApprovers } from "../lib/notifications.server";
import type { AppUser } from "../lib/server-fn";

function normalizeReason(value: string | undefined | null) {
	return value && value.trim().length > 0 ? value.trim() : null;
}

export const applyForLeaveSchema = z.object({
	leave_type: z.string(),
	start_date: z.string(),
	end_date: z.string(),
	start_day_portion: z.string(),
	end_day_portion: z.string(),
	reason: z.string().optional().nullable(),
});

/**
 * The single source of truth for submitting a leave request — used by the applyForLeave
 * server fn and by the AI assistant's proposal-confirmation flow, so an AI-confirmed request
 * gets the exact same policy validation and approver notification a human submission gets.
 *
 * Kept in its own .server.ts file (rather than inline in leaves.ts) because leaves.ts is
 * imported directly by client components — a plain top-level function referencing
 * notifyApprovers/validateLeaveRequest there would pull those .server modules into the
 * client bundle, since only createServerFn().handler() bodies get stripped for the client.
 */
export async function applyForLeaveCore(
	db: Database,
	user: AppUser,
	input: z.infer<typeof applyForLeaveSchema>,
) {
	const types = await db
		.select({ slug: systemLeaveTypes.slug, name: systemLeaveTypes.name })
		.from(systemLeaveTypes);
	const matchedType = resolveLeaveType(input.leave_type, types);
	const resolvedLeaveType = matchedType ? matchedType.slug : input.leave_type;

	const rawInput = {
		leave_type: resolvedLeaveType,
		start_date: input.start_date,
		end_date: input.end_date,
		start_day_portion: input.start_day_portion || "full_day",
		end_day_portion: input.end_day_portion || "full_day",
		reason: normalizeReason(input.reason),
	};

	const validation = await validateLeaveRequest(db, user, rawInput);

	if (
		validation.error ||
		!validation.success ||
		validation.totalDays === undefined
	) {
		return { error: validation.error || "Validation failed." };
	}

	const { totalDays, ruleViolationNote } = validation;
	const isSingleDay = rawInput.start_date === rawInput.end_date;

	const [request] = await db
		.insert(leaveRequests)
		.values({
			id: crypto.randomUUID(),
			userId: user.id,
			leaveType: rawInput.leave_type,
			startDate: rawInput.start_date,
			endDate: rawInput.end_date,
			isHalfDayStart: rawInput.start_day_portion !== "full_day",
			halfDayStartPeriod:
				rawInput.start_day_portion === "full_day"
					? null
					: rawInput.start_day_portion,
			isHalfDayEnd: !isSingleDay && rawInput.end_day_portion !== "full_day",
			halfDayEndPeriod:
				!isSingleDay && rawInput.end_day_portion !== "full_day"
					? rawInput.end_day_portion
					: null,
			totalDays: totalDays,
			reason: rawInput.reason,
			status: "pending",
		})
		.returning({ id: leaveRequests.id });

	if (!request) {
		return { error: "Failed to submit leave request." };
	}

	const approvalsUrl = "/approvals";
	const displayStart = formatDateDisplay(rawInput.start_date);
	const displayEnd = formatDateDisplay(rawInput.end_date);
	const requesterName = user.name ?? "A team member";
	const requestSummary = `${requesterName} applied for ${rawInput.leave_type} leave from ${displayStart} to ${displayEnd} (${totalDays} day${totalDays === 1 ? "" : "s"}).`;
	const reasonLine = rawInput.reason
		? `Reason: ${rawInput.reason}`
		: "Reason: Not provided";

	const violationSuffix = ruleViolationNote
		? `\n\n⚠️ POLICY ALERT:\n${ruleViolationNote}`
		: "";

	await notifyApprovers(db, {
		requesterId: user.id,
		type: "leave_requested",
		title: `Leave request from ${requesterName}${ruleViolationNote ? " (LATE APPLICATION)" : ""}`,
		body: `${requestSummary} ${reasonLine}${violationSuffix}`,
		relatedId: request.id,
		relatedType: "leave_request",
		actionUrl: approvalsUrl,
		emailSubject: `Leave request: ${requesterName} (${displayStart} to ${displayEnd})${ruleViolationNote ? " - LATE APPLICATION" : ""}`,
		emailBody: [
			requestSummary,
			reasonLine,
			ruleViolationNote
				? `\n⚠️ Late Application Rule Violation:\n${ruleViolationNote}\n`
				: "",
			"",
			"Please review this request in Brainee.org.",
		].join("\n"),
	});

	return { success: true };
}
