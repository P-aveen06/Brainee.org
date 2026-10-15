/**
 * Deterministic rule-based work flag evaluators.
 * Pure functions: zero side effects, no AI models required.
 */

export interface WorkFlagEvaluation {
	flagCode: string;
	severity: "info" | "warning";
	message: string;
	evidence?: Record<string, unknown>;
}

/**
 * Flag Rule: no_task_linked
 * Raises an info flag if a submitted daily update does not link any specific tasks.
 */
export function checkNoTaskLinked(input: {
	status: string;
	itemCount: number;
}): WorkFlagEvaluation | null {
	if (input.status !== "submitted") return null;

	if (input.itemCount === 0) {
		return {
			flagCode: "no_task_linked",
			severity: "info",
			message:
				"Daily update was submitted without linking any specific project tasks.",
			evidence: { itemCount: 0 },
		};
	}

	return null;
}

/**
 * Flag Rule: stalled
 * Raises a warning if a task is 'in_progress' and hasn't been referenced in updates or updated for > thresholdDays.
 */
export function checkStalledTask(input: {
	status: string;
	lastReferencedDate?: string | null;
	today: string;
	thresholdDays?: number;
}): WorkFlagEvaluation | null {
	if (input.status !== "in_progress") return null;

	const threshold = input.thresholdDays ?? 3;
	if (!input.lastReferencedDate) {
		return {
			flagCode: "stalled",
			severity: "warning",
			message: `Task has been in progress with no activity or updates logged for more than ${threshold} days.`,
			evidence: { thresholdDays: threshold, lastReferencedDate: null },
		};
	}

	const refDate = new Date(input.lastReferencedDate);
	const currDate = new Date(input.today);
	const diffTime = currDate.getTime() - refDate.getTime();
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

	if (diffDays >= threshold) {
		return {
			flagCode: "stalled",
			severity: "warning",
			message: `Task has been in progress with no updates for ${diffDays} days (threshold: ${threshold} days).`,
			evidence: {
				daysSinceUpdate: diffDays,
				thresholdDays: threshold,
				lastReferencedDate: input.lastReferencedDate,
			},
		};
	}

	return null;
}

/**
 * Flag Rule: estimate_exceeded
 * Raises a warning if actual hours logged exceeds estimated hours by the multiplier threshold (default 1.25x / 125%).
 */
export function checkEstimateExceeded(input: {
	estimateHours?: number | null;
	actualHours?: number | null;
	thresholdMultiplier?: number;
}): WorkFlagEvaluation | null {
	if (!input.estimateHours || input.estimateHours <= 0) return null;
	if (!input.actualHours || input.actualHours <= 0) return null;

	const threshold = input.thresholdMultiplier ?? 1.25;
	const allowedHours = input.estimateHours * threshold;

	if (input.actualHours > allowedHours) {
		const percentOver = Math.round(
			((input.actualHours - input.estimateHours) / input.estimateHours) * 100,
		);
		return {
			flagCode: "estimate_exceeded",
			severity: "warning",
			message: `Logged time (${input.actualHours}h) exceeds estimate (${input.estimateHours}h) by ${percentOver}%.`,
			evidence: {
				estimateHours: input.estimateHours,
				actualHours: input.actualHours,
				thresholdMultiplier: threshold,
				percentOver,
			},
		};
	}

	return null;
}
