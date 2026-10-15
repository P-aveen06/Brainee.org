import { addIsoDays } from "../../leave-policy";

const WEEKDAYS = new Map([
	["sunday", 0],
	["sun", 0],
	["monday", 1],
	["mon", 1],
	["tuesday", 2],
	["tue", 2],
	["wednesday", 3],
	["wed", 3],
	["thursday", 4],
	["thu", 4],
	["friday", 5],
	["fri", 5],
	["saturday", 6],
	["sat", 6],
]);

const MONTHS = new Map([
	["january", 1],
	["jan", 1],
	["february", 2],
	["feb", 2],
	["march", 3],
	["mar", 3],
	["april", 4],
	["apr", 4],
	["may", 5],
	["june", 6],
	["jun", 6],
	["july", 7],
	["jul", 7],
	["august", 8],
	["aug", 8],
	["september", 9],
	["sep", 9],
	["sept", 9],
	["october", 10],
	["oct", 10],
	["november", 11],
	["nov", 11],
	["december", 12],
	["dec", 12],
]);

export type DateResolution =
	| { status: "resolved"; isoDate: string; originalText: string }
	| { status: "invalid"; reason: string };

function validIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00.000Z`);
	return (
		!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
	);
}

function formatIsoDate(
	year: number,
	month: number,
	day: number,
): string | null {
	const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	return validIsoDate(value) ? value : null;
}

function resolveWeekday(
	input: string,
	referenceDateIso: string,
): string | null {
	const match = input.match(/^(?:(this|next)\s+)?([a-z]+)$/);
	if (!match) return null;
	const targetDay = WEEKDAYS.get(match[2]);
	if (targetDay === undefined) return null;

	const reference = new Date(`${referenceDateIso}T00:00:00.000Z`);
	let daysAhead = (targetDay - reference.getUTCDay() + 7) % 7;
	if (daysAhead === 0) daysAhead = 7;
	if (match[1] === "next") daysAhead += 7;
	return addIsoDays(referenceDateIso, daysAhead);
}

function resolvePartialDate(
	input: string,
	referenceDateIso: string,
): string | null {
	const monthFirst = input.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
	const dayFirst = input.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)$/);
	const monthName = monthFirst?.[1] ?? dayFirst?.[2];
	const dayText = monthFirst?.[2] ?? dayFirst?.[1];
	if (!monthName || !dayText) return null;

	const month = MONTHS.get(monthName);
	if (!month) return null;
	const day = Number(dayText);
	let year = Number(referenceDateIso.slice(0, 4));
	let candidate = formatIsoDate(year, month, day);
	if (!candidate) return null;
	if (candidate < referenceDateIso) {
		year += 1;
		candidate = formatIsoDate(year, month, day);
	}
	return candidate;
}

export function resolveRelativeDate(
	value: string,
	referenceDateIso: string,
): DateResolution {
	const originalText = value;
	const input = value
		.trim()
		.toLowerCase()
		.replace(/[,.]/g, "")
		.replace(/\s+/g, " ");
	if (!validIsoDate(referenceDateIso)) {
		return { status: "invalid", reason: "Reference date must be YYYY-MM-DD." };
	}
	if (validIsoDate(input))
		return { status: "resolved", isoDate: input, originalText };

	const relativeDays: Record<string, number> = {
		today: 0,
		tomorrow: 1,
		"day after tomorrow": 2,
	};
	if (input in relativeDays) {
		return {
			status: "resolved",
			isoDate: addIsoDays(referenceDateIso, relativeDays[input]),
			originalText,
		};
	}

	const resolved =
		resolveWeekday(input, referenceDateIso) ||
		resolvePartialDate(input, referenceDateIso);
	if (resolved) return { status: "resolved", isoDate: resolved, originalText };
	return {
		status: "invalid",
		reason: `Could not resolve date "${originalText}".`,
	};
}
