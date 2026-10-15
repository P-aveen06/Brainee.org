import { type DayPortion, getLeaveCycleBounds } from "./leave-policy";

export const DEFAULT_WFH_ALLOWANCE = 12;
export const WFH_POLICY_ID = 1;
const WFH_DATE_DUPLICATE_ERROR =
	"A WFH request already exists for this date. Review the existing request before submitting another one.";

export function getWfhRequestDays(dayPortion: DayPortion) {
	return dayPortion === "full_day" ? 1 : 0.5;
}

export function getWfhCycleBounds(birthday: string, selectedDate: string) {
	return getLeaveCycleBounds(
		birthday,
		new Date(`${selectedDate}T12:00:00.000Z`),
	);
}

export function isValidWfhAllowance(value: number) {
	return value >= 0.5 && value <= 365 && Number.isInteger(value * 2);
}

export function isValidWfhDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const parsed = new Date(`${value}T12:00:00.000Z`);
	return (
		!Number.isNaN(parsed.getTime()) &&
		parsed.toISOString().slice(0, 10) === value
	);
}

export function getExistingWfhDateError(existingStatus: string | undefined) {
	return existingStatus === undefined ? null : WFH_DATE_DUPLICATE_ERROR;
}

export function isSqliteWfhDateUniqueConstraintError(error: unknown) {
	return (
		error instanceof Error &&
		error.message.includes("UNIQUE constraint failed") &&
		error.message.includes("wfh_requests.user_id") &&
		error.message.includes("wfh_requests.date")
	);
}

export function isCurrentWfhQuotaRequest(
	requestId: number,
	currentRequestId: number,
) {
	return requestId === currentRequestId;
}

export function calculateWfhQuota({
	allowance,
	reserved,
	requested = 0,
}: {
	allowance: number;
	reserved: number;
	requested?: number;
}) {
	const remaining = Math.max(0, allowance - reserved);
	return {
		used: reserved,
		remaining,
		canRequest: requested <= remaining,
	};
}
