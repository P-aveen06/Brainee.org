/** Pure helpers behind the Hours card: month heatmap cells, logging streak and pace. */

export type CellState =
	| "future"
	| "off"
	| "missed"
	| "today"
	| "partial"
	| "full"
	| "over";

export interface HeatCell {
	date: string;
	state: CellState;
	hours: number;
}

const iso = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function parse(date: string) {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function isWeekday(date: string) {
	const dow = parse(date).getDay();
	return dow !== 0 && dow !== 6;
}

function shift(date: string, days: number) {
	const d = parse(date);
	d.setDate(d.getDate() + days);
	return iso(d);
}

interface Input {
	today: string;
	hoursByDate: Map<string, number>;
	/** Public holidays and the user's own approved leave. */
	offDates: Set<string>;
	standardHours: number;
}

function stateFor(
	date: string,
	{ today, hoursByDate, offDates, standardHours }: Input,
): CellState {
	const hours = hoursByDate.get(date) ?? 0;
	if (hours > 0) {
		if (hours > standardHours + 0.01) return "over";
		return hours >= standardHours - 0.01 ? "full" : "partial";
	}
	if (offDates.has(date)) return "off";
	if (date > today) return "future";
	return date === today ? "today" : "missed";
}

/** Weeks (columns) of Monday-Friday cells for a month; null where the date falls outside it. */
export function buildHeatmapWeeks(
	month: string,
	input: Input,
): (HeatCell | null)[][] {
	const [y, m] = month.split("-").map(Number);
	const last = new Date(y, m, 0).getDate();
	const weeks: (HeatCell | null)[][] = [];
	for (let day = 1; day <= last; day++) {
		const date = `${month}-${String(day).padStart(2, "0")}`;
		if (!isWeekday(date)) continue;
		const dow = (parse(date).getDay() + 6) % 7; // Mon = 0
		if (weeks.length === 0 || dow === 0)
			weeks.push([null, null, null, null, null]);
		weeks[weeks.length - 1][dow] = {
			date,
			state: stateFor(date, input),
			hours: input.hoursByDate.get(date) ?? 0,
		};
	}
	return weeks;
}

/**
 * Consecutive working days with hours logged, counting back from today. Weekends,
 * holidays and leave are skipped rather than breaking it, and an unlogged today
 * doesn't break it until the day is over.
 */
export function computeStreak(input: Input, maxDays = 60): number {
	const { today, hoursByDate, offDates } = input;
	let streak = (hoursByDate.get(today) ?? 0) > 0 ? 1 : 0;
	let cursor = shift(today, -1);
	for (let i = 0; i < maxDays; i++, cursor = shift(cursor, -1)) {
		if (!isWeekday(cursor) || offDates.has(cursor)) continue;
		if ((hoursByDate.get(cursor) ?? 0) > 0) streak++;
		else break;
	}
	return streak;
}
