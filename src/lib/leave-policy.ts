export const DAY_PORTIONS = ["full_day", "first_half", "second_half"] as const;
export type DayPortion = (typeof DAY_PORTIONS)[number];

export const HALF_DAY_PERIODS = ["first_half", "second_half"] as const;
export type HalfDayPeriod = (typeof HALF_DAY_PERIODS)[number];

export const ACTIVE_LEAVE_REQUEST_STATUSES = [
	"pending",
	"approved",
	"pending_cancellation",
] as const;

/** Leave statuses that should behave like approved leave in operational views. */
export const OPERATIONALLY_ACTIVE_LEAVE_STATUSES = [
	"approved",
	"pending_cancellation",
] as const;

export function getLeaveCancellationTargetStatus(status: string) {
	if (status === "pending") return "cancelled" as const;
	if (status === "approved") return "pending_cancellation" as const;
	return null;
}

export function formatLeaveType(value: string) {
	if (!value) return value;
	return value
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

// All "what day is it" decisions are anchored to the company timezone so
// behavior is identical on Workers (UTC) and any developer machine.
export const APP_TIMEZONE = "Asia/Kolkata";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: APP_TIMEZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

export function getTodayIsoDate(date = new Date()) {
	const parts = isoDateFormatter.formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;
	if (!year || !month || !day) {
		throw new Error("Could not format date for application timezone.");
	}
	return `${year}-${month}-${day}`;
}

function pad2(value: number) {
	return String(value).padStart(2, "0");
}

function isoDateToUtcDate(isoDate: string) {
	return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Formats a UTC date back to YYYY-MM-DD without host-timezone conversion. */
function toIsoDate(date: Date) {
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function addIsoDays(isoDate: string, days: number) {
	const date = isoDateToUtcDate(isoDate);
	date.setUTCDate(date.getUTCDate() + days);
	return toIsoDate(date);
}

export function getIsoYear(isoDate: string) {
	return Number(isoDate.slice(0, 4));
}

export function getIsoMonth(isoDate: string) {
	return Number(isoDate.slice(5, 7));
}

export function isWeekendDate(isoDate: string) {
	const day = isoDateToUtcDate(isoDate).getUTCDay();
	return day === 0 || day === 6;
}

export function getDateRange(startDate: string, endDate: string) {
	const dates: string[] = [];
	const cursor = isoDateToUtcDate(startDate);
	const end = isoDateToUtcDate(endDate);

	while (cursor <= end) {
		dates.push(toIsoDate(cursor));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return dates;
}

/**
 * A user's leave cycle runs one year starting on the 1st of their birthday
 * month (intentional product policy). Months are extracted from ISO strings
 * so the result never depends on the host timezone.
 */
export function getLeaveCycleBounds(birthday: string, today = new Date()) {
	const todayIso = getTodayIsoDate(today);
	const todayYear = getIsoYear(todayIso);
	const todayMonth = getIsoMonth(todayIso);
	const birthdayMonth = getIsoMonth(birthday);

	const cycleYear = todayMonth >= birthdayMonth ? todayYear : todayYear - 1;

	// Last day of the month before the birthday month, next year.
	const cycleEndDate = new Date(Date.UTC(cycleYear + 1, birthdayMonth - 1, 0));

	return {
		cycleStart: `${cycleYear}-${pad2(birthdayMonth)}-01`,
		cycleEnd: toIsoDate(cycleEndDate),
	};
}

export function getCompletedServiceYears(
	joinDate: string | null,
	cycleStart: string,
) {
	if (!joinDate || joinDate > cycleStart) return 0;

	const years = getIsoYear(cycleStart) - getIsoYear(joinDate);
	return cycleStart.slice(5) < joinDate.slice(5) ? years - 1 : years;
}

export function calculateBusinessLeaveDays(input: {
	startDate: string;
	endDate: string;
	startDayPortion: DayPortion;
	endDayPortion: DayPortion;
	holidayDates: string[];
}) {
	const { startDate, endDate, startDayPortion, endDayPortion, holidayDates } =
		input;
	const workingDates = getDateRange(startDate, endDate).filter(
		(date) => !holidayDates.includes(date) && !isWeekendDate(date),
	);

	if (workingDates.length === 0) {
		return 0;
	}

	if (startDate === endDate) {
		return startDayPortion === "full_day" ? 1 : 0.5;
	}

	let total = workingDates.length;

	if (startDayPortion !== "full_day" && workingDates.includes(startDate)) {
		total -= 0.5;
	}

	if (endDayPortion !== "full_day" && workingDates.includes(endDate)) {
		total -= 0.5;
	}

	return total;
}

export function getLeaveCoverageForDate(input: {
	date: string;
	endDate: string;
	startDate: string;
	isHalfDayEnd: boolean;
	isHalfDayStart: boolean;
	halfDayEndPeriod: string | null;
	halfDayStartPeriod: string | null;
}) {
	const {
		date,
		endDate,
		startDate,
		isHalfDayEnd,
		isHalfDayStart,
		halfDayEndPeriod,
		halfDayStartPeriod,
	} = input;

	if (date < startDate || date > endDate) {
		return null;
	}

	if (startDate === endDate) {
		if (!isHalfDayStart) {
			return "full_day";
		}

		return halfDayStartPeriod as HalfDayPeriod;
	}

	if (date === startDate && isHalfDayStart) {
		return halfDayStartPeriod as HalfDayPeriod;
	}

	if (date === endDate && isHalfDayEnd) {
		return halfDayEndPeriod as HalfDayPeriod;
	}

	return "full_day";
}

/**
 * Working days of advance notice: business days (excluding weekends and any
 * supplied holidays) from the day after the application date through the start
 * date, inclusive. Applying on the same weekday one full work-week ahead yields
 * exactly 5 — i.e. "5 working days notice" == "apply a week ahead".
 */
export function calculateWorkingDaysInAdvance(
	startDate: string,
	applicationDate: string,
	holidayDates: string[] = [],
): number {
	const firstDate = addIsoDays(applicationDate, 1);

	if (firstDate > startDate) return 0;

	const range = getDateRange(firstDate, startDate);
	return range.filter(
		(date) => !isWeekendDate(date) && !holidayDates.includes(date),
	).length;
}
