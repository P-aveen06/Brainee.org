import { format, isValid, parse } from "date-fns";

export const DISPLAY_DATE_FORMAT = "dd-MM-yyyy";
export const DISPLAY_DATE_TIME_FORMAT = "dd-MM-yyyy HH:mm:ss";

const ISO_DATE_FORMAT = "yyyy-MM-dd";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: string, dateFormat: string) {
	const parsed = parse(value, dateFormat, new Date());

	if (!isValid(parsed) || format(parsed, dateFormat) !== value) {
		return null;
	}

	return parsed;
}

export function parseDateInputToIso(value: unknown) {
	if (typeof value !== "string") return "";

	const trimmed = value.trim();
	if (!trimmed) return "";

	if (ISO_DATE_PATTERN.test(trimmed)) {
		return parseDateOnly(trimmed, ISO_DATE_FORMAT) ? trimmed : "";
	}

	const parsed = parseDateOnly(trimmed, DISPLAY_DATE_FORMAT);
	return parsed ? format(parsed, ISO_DATE_FORMAT) : "";
}

export function formatDateDisplay(value: Date | string | null | undefined) {
	if (!value) return "";

	if (value instanceof Date) {
		return isValid(value) ? format(value, DISPLAY_DATE_FORMAT) : "";
	}

	const iso = parseDateOnly(value, ISO_DATE_FORMAT);
	if (iso) return format(iso, DISPLAY_DATE_FORMAT);

	const display = parseDateOnly(value, DISPLAY_DATE_FORMAT);
	return display ? format(display, DISPLAY_DATE_FORMAT) : value;
}

export function formatDateTimeDisplay(value: Date | string | null | undefined) {
	if (!value) return "";

	const parsed = value instanceof Date ? value : new Date(value);
	return isValid(parsed) ? format(parsed, DISPLAY_DATE_TIME_FORMAT) : "";
}
