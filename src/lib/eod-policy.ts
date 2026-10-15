/**
 * Pure policy and deterministic formatting for Daily Updates & EOD Reports.
 * Zero database queries, zero side effects. Strictly unit-testable.
 */
import { getTodayIsoDate } from "./leave-policy";

export * from "./eod-policy.types";

import type {
	EodReportSkeleton,
	EodSkeletonMemberUpdate,
	EodSubmissionMember,
	EodSubmissionState,
	EodSubmittedUpdateRef,
	EodTaskItem,
} from "./eod-policy.types";

/**
 * Resolves the current EOD submission state.
 *
 * Rules:
 * 1. Only 'current' members (isCurrent !== false && isActive !== false) are expected.
 * 2. 'viewer'-role members are NOT expected to submit updates.
 * 3. Only 'submitted' status updates count towards completion ('draft' does not).
 * 4. canGenerate is true if all expected members have submitted, OR if the caller has manager/owner rights.
 */
export function resolveEodSubmissionState(input: {
	members: EodSubmissionMember[];
	submittedUpdates: EodSubmittedUpdateRef[];
	callerRole: string;
}): EodSubmissionState {
	// Filter expected members: active & not viewers
	const expected = input.members
		.filter((m) => {
			if (m.isCurrent === false) return false;
			if (m.isActive === false) return false;
			if (m.role === "viewer") return false;
			return true;
		})
		.map((m) => ({
			userId: m.userId,
			name: m.userName || "Unnamed Member",
		}));

	const submittedSet = new Set(
		input.submittedUpdates
			.filter((u) => u.status === "submitted")
			.map((u) => u.userId),
	);

	const missing = expected.filter((m) => !submittedSet.has(m.userId));
	const allSubmitted = missing.length === 0;

	const callerIsManager =
		input.callerRole === "owner" || input.callerRole === "manager";
	const canGenerate = allSubmitted || callerIsManager;

	return {
		expected,
		submitted: Array.from(submittedSet),
		missing,
		allSubmitted,
		canGenerate,
	};
}

function formatEodDate(isoDate: string): string {
	try {
		const parts = isoDate.split("-");
		if (parts.length === 3) {
			const months = [
				"Jan",
				"Feb",
				"Mar",
				"Apr",
				"May",
				"Jun",
				"Jul",
				"Aug",
				"Sep",
				"Oct",
				"Nov",
				"Dec",
			];
			const day = parts[2].padStart(2, "0");
			const month = months[Number.parseInt(parts[1], 10) - 1] || parts[1];
			const year = parts[0];
			return `${day} ${month} ${year}`;
		}
	} catch {}
	return isoDate;
}

function cleanOutcomeText(text: string): string {
	return (
		text
			// Remove "(Subtask #5 done)", "(Subtask #5)", "(Task #10)", etc.
			.replace(/\s*\((?:subtask|task)\s*#?\d+(?:\s+done)?\)/gi, "")
			// Remove "Subtask #5:" or "Task #10:"
			.replace(/\b(?:subtask|task)\s*#?\d+:?\s*/gi, "")
			// Remove "(Xh logged)"
			.replace(/\s*\(\d+(?:\.\d+)?h\s+logged\)/gi, "")
			.trim()
	);
}

/**
 * Deterministically assembles an EOD report in client-facing email format.
 * Follows the corporate standard:
 * - Clean deliverables without internal developer names or task IDs
 * - Standardized sections: Progress completed today, Currently in progress,
 *   Next planned activities, Dependencies / support required, Decisions / confirmations
 */
export function assembleEodSkeleton(input: {
	projectCode: string;
	projectName: string;
	date: string;
	pocName?: string | null;
	overallStatus?: string;
	updates: EodSkeletonMemberUpdate[];
	tasks?: EodTaskItem[];
	missingMembers?: Array<{ userId: string; name: string }>;
}): EodReportSkeleton {
	const formattedDate = formatEodDate(input.date);
	const poc = (input.pocName || "Team").trim();

	const hasBlockers =
		input.updates.some((u) => u.blockers && u.blockers.trim().length > 0) ||
		input.tasks?.some((t) => t.status === "blocked");
	const overallStatus =
		input.overallStatus || (hasBlockers ? "Attention Required" : "In Progress");

	const lines: string[] = [];

	lines.push("Subject:");
	lines.push(`[EOD Update] ${input.projectName} | ${formattedDate}`);
	lines.push("");
	lines.push("Email Format:");
	lines.push("");
	lines.push(`Hi ${poc},`);
	lines.push(
		`Please find below the EOD update for ${input.projectName} for ${formattedDate}.`,
	);
	lines.push("");
	lines.push(`Overall status: ${overallStatus}`);
	lines.push("");

	// 1. Progress completed today
	lines.push("Progress completed today:");
	const completedItems: string[] = [];

	if (input.tasks) {
		for (const t of input.tasks) {
			if (t.status === "done") {
				if (t.completedAt) {
					const completedIso = getTodayIsoDate(new Date(t.completedAt));
					if (completedIso === input.date) {
						completedItems.push(cleanOutcomeText(t.title));
					}
				} else {
					completedItems.push(cleanOutcomeText(t.title));
				}
			}
		}
	}

	for (const u of input.updates) {
		if (u.summary?.trim()) {
			const cleaned = cleanOutcomeText(u.summary);
			if (
				cleaned &&
				!completedItems.some((ci) =>
					cleaned.toLowerCase().includes(ci.toLowerCase()),
				)
			) {
				completedItems.push(cleaned);
			}
		}
	}

	if (completedItems.length === 0) {
		lines.push("- None");
	} else {
		for (const item of completedItems) {
			lines.push(`- ${item}`);
		}
	}
	lines.push("");

	// 2. Currently in progress
	lines.push("Currently in progress:");
	const inProgressItems: string[] = [];
	if (input.tasks) {
		for (const t of input.tasks) {
			if (t.status === "in_progress") {
				const due = t.dueDate ? formatEodDate(t.dueDate) : "To be confirmed";
				inProgressItems.push(
					`- ${cleanOutcomeText(t.title)} — Expected completion: ${due}`,
				);
			}
		}
	}

	if (inProgressItems.length === 0) {
		lines.push("- None.");
	} else {
		for (const item of inProgressItems.slice(0, 5)) {
			lines.push(item);
		}
	}
	lines.push("");

	// 3. Next planned activities
	lines.push("Next planned activities:");
	const nextItems: string[] = [];
	if (input.tasks) {
		for (const t of input.tasks) {
			if (t.status === "todo" && t.dueDate) {
				nextItems.push(
					`- ${cleanOutcomeText(t.title)} — Planned by: ${formatEodDate(t.dueDate)}`,
				);
			}
		}
	}

	if (nextItems.length === 0) {
		lines.push("- None.");
	} else {
		for (const item of nextItems.slice(0, 4)) {
			lines.push(item);
		}
	}
	lines.push("");

	// 4. Dependencies / support required
	lines.push("Dependencies / support required:");
	const depItems: string[] = [];

	if (input.tasks) {
		for (const t of input.tasks) {
			if (t.status === "blocked" && t.blockedReason?.trim()) {
				const reason = cleanOutcomeText(t.blockedReason);
				const title = cleanOutcomeText(t.title);
				depItems.push(
					`- ${title}\n Required from: Client Partner / Systems Team\n Required by: ${t.dueDate ? formatEodDate(t.dueDate) : "Immediate"}\n Delivery impact: ${reason}`,
				);
			}
		}
	}

	for (const u of input.updates) {
		if (u.blockers?.trim()) {
			const cleanedBlocker = cleanOutcomeText(u.blockers);
			if (!depItems.some((di) => di.includes(cleanedBlocker))) {
				depItems.push(
					`- ${cleanedBlocker}\n Required from: Client Architecture / External Team\n Required by: Immediate\n Delivery impact: Downstream integration and verification blocked`,
				);
			}
		}
	}

	if (depItems.length === 0) {
		lines.push("- None.");
	} else {
		for (const d of depItems.slice(0, 3)) {
			lines.push(d);
		}
	}
	lines.push("");

	// 5. Decisions / confirmations
	lines.push("Decisions / confirmations:");
	lines.push("- None.");
	lines.push("");

	// 6. Signoff
	lines.push("Please let us know if you need any additional information.");
	lines.push("");
	lines.push("Thanks & Regards,");

	return {
		projectCode: input.projectCode,
		projectName: input.projectName,
		date: input.date,
		contentDraft: lines.join("\n").trimEnd(),
	};
}
