import { getTodayIsoDate } from "../leave-policy";
import { resolveRelativeDate } from "./normalization/relative-date";

export const TRANSCRIPT_CATEGORIES = [
	"decision",
	"action_item",
	"deadline",
	"status",
	"ownership",
	"risk",
	"issue",
	"dependency",
	"scope_change",
	"requirement",
	"question",
] as const;

export type TranscriptCategory = (typeof TRANSCRIPT_CATEGORIES)[number];
export type ComparisonStatus =
	| "confirmed"
	| "new_information"
	| "possible_contradiction"
	| "project_data_may_be_stale"
	| "duplicate"
	| "unverifiable"
	| "requires_clarification";

export interface TranscriptClaim {
	category: TranscriptCategory;
	statement: string;
	sourceTimestamp?: string;
	speaker?: string;
	taskQuery?: string;
	proposedDate?: string;
	proposedOwner?: string;
	proposedStatus?: string;
}

export interface ComparableTask {
	id: string;
	taskNumber: number;
	title: string;
	status: string;
	dueDate: string | null;
	assigneeName: string | null;
}

export interface TranscriptFinding {
	claim: TranscriptClaim;
	status: ComparisonStatus;
	reason: string;
	evidence?: { id: string; label: string; currentValue?: string | null };
}

export function parseTranscriptClaims(value: unknown): TranscriptClaim[] {
	if (!Array.isArray(value)) return [];
	const categories = new Set<string>(TRANSCRIPT_CATEGORIES);
	return value.slice(0, 30).flatMap((item) => {
		if (!item || typeof item !== "object") return [];
		const record = item as Record<string, unknown>;
		if (
			typeof record.category !== "string" ||
			!categories.has(record.category) ||
			typeof record.statement !== "string" ||
			!record.statement.trim()
		) {
			return [];
		}
		const optionalString = (key: string) =>
			typeof record[key] === "string"
				? String(record[key]).trim().slice(0, 500)
				: undefined;
		return [
			{
				category: record.category as TranscriptCategory,
				statement: record.statement.trim().slice(0, 2_000),
				sourceTimestamp: optionalString("sourceTimestamp"),
				speaker: optionalString("speaker"),
				taskQuery: optionalString("taskQuery"),
				proposedDate: optionalString("proposedDate"),
				proposedOwner: optionalString("proposedOwner"),
				proposedStatus: optionalString("proposedStatus"),
			},
		];
	});
}

function normalize(value: string | null | undefined): string {
	return (value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[-_]/g, " ")
		.replace(/\s+/g, " ");
}

function statusValue(value: string): string {
	const normalized = normalize(value);
	if (["complete", "completed", "finished", "done"].includes(normalized))
		return "done";
	if (["started", "working", "in progress"].includes(normalized))
		return "in progress";
	if (["blocked", "stuck"].includes(normalized)) return "blocked";
	if (["review", "in review"].includes(normalized)) return "in review";
	if (["open", "todo", "to do"].includes(normalized)) return "todo";
	return normalized;
}

function findTask(
	claim: TranscriptClaim,
	tasks: ComparableTask[],
): ComparableTask | undefined {
	const query = normalize(claim.taskQuery);
	if (!query) return undefined;
	const exact = tasks.find((task) => normalize(task.title) === query);
	if (exact) return exact;
	const matches = tasks.filter((task) => {
		const title = normalize(task.title);
		return title.includes(query) || query.includes(title);
	});
	return matches.length === 1 ? matches[0] : undefined;
}

export function compareTranscriptClaims(input: {
	claims: TranscriptClaim[];
	tasks: ComparableTask[];
	project: {
		id: string;
		name: string;
		status: string;
		targetEndDate: string | null;
	};
	referenceDateIso?: string;
}): TranscriptFinding[] {
	const referenceDateIso = input.referenceDateIso ?? getTodayIsoDate();
	return input.claims.map((claim) => {
		const task = findTask(claim, input.tasks);
		const evidence = task
			? { id: task.id, label: `#${task.taskNumber} ${task.title}` }
			: { id: input.project.id, label: input.project.name };

		if (claim.taskQuery && !task) {
			return {
				claim,
				status: "requires_clarification",
				reason: `No unique accessible task matched "${claim.taskQuery}".`,
				evidence,
			};
		}

		if (claim.category === "deadline" && claim.proposedDate) {
			const resolved = resolveRelativeDate(
				claim.proposedDate,
				referenceDateIso,
			);
			if (resolved.status !== "resolved") {
				return {
					claim,
					status: "requires_clarification",
					reason: resolved.reason,
					evidence,
				};
			}
			const currentDate = task?.dueDate ?? input.project.targetEndDate;
			if (!currentDate) {
				return {
					claim,
					status: "new_information",
					reason: "No current deadline is recorded.",
					evidence,
				};
			}
			return {
				claim,
				status:
					currentDate === resolved.isoDate
						? "confirmed"
						: "possible_contradiction",
				reason:
					currentDate === resolved.isoDate
						? "The transcript deadline matches the current record."
						: `Transcript deadline ${resolved.isoDate} differs from recorded deadline ${currentDate}.`,
				evidence: { ...evidence, currentValue: currentDate },
			};
		}

		if (claim.category === "ownership" && claim.proposedOwner && task) {
			const currentOwner = normalize(task.assigneeName);
			const proposedOwner = normalize(claim.proposedOwner);
			if (!currentOwner) {
				return {
					claim,
					status: "new_information",
					reason: "The matched task is currently unassigned.",
					evidence,
				};
			}
			const same =
				currentOwner.includes(proposedOwner) ||
				proposedOwner.includes(currentOwner);
			return {
				claim,
				status: same ? "confirmed" : "possible_contradiction",
				reason: same
					? "The named owner matches the task assignee."
					: `Transcript owner differs from recorded owner ${task.assigneeName}.`,
				evidence: { ...evidence, currentValue: task.assigneeName },
			};
		}

		if (claim.category === "status" && claim.proposedStatus && task) {
			const currentStatus = statusValue(task.status);
			const proposedStatus = statusValue(claim.proposedStatus);
			return {
				claim,
				status:
					currentStatus === proposedStatus
						? "confirmed"
						: "project_data_may_be_stale",
				reason:
					currentStatus === proposedStatus
						? "The transcript status matches the task."
						: `Transcript status differs from recorded status ${task.status}.`,
				evidence: { ...evidence, currentValue: task.status },
			};
		}

		if (
			[
				"risk",
				"issue",
				"decision",
				"action_item",
				"dependency",
				"scope_change",
				"requirement",
			].includes(claim.category)
		) {
			return {
				claim,
				status: task ? "duplicate" : "new_information",
				reason: task
					? "A matching task already exists."
					: "No matching structured project record was identified.",
				evidence,
			};
		}

		return {
			claim,
			status: "unverifiable",
			reason:
				"The claim cannot be compared deterministically with current structured fields.",
			evidence,
		};
	});
}
