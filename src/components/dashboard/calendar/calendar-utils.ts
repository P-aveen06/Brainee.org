import type {
	CalendarEvent,
	CalendarEventKind,
} from "#/lib/dashboard-calendar.server";

export const KIND_STYLE: Record<
	CalendarEventKind,
	{ label: string; dot: string }
> = {
	leave: { label: "On leave", dot: "bg-amber-500" },
	wfh: { label: "WFH", dot: "bg-cyan-500" },
	birthday: { label: "Birthday", dot: "bg-ai-pink" },
	holiday: { label: "Holiday", dot: "bg-emerald-500" },
};

const pad = (n: number) => String(n).padStart(2, "0");

export function toIso(d: Date) {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, days: number) {
	const [y, m, d] = iso.split("-").map(Number);
	return toIso(new Date(y, m - 1, d + days));
}

export function shiftMonth(month: string, delta: number) {
	const [y, m] = month.split("-").map(Number);
	const d = new Date(y, m - 1 + delta, 1);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(month: string) {
	const [y, m] = month.split("-").map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});
}

/** Monday-first weeks covering the month, padded with neighbouring days. */
export function buildMonthGrid(month: string) {
	const [y, m] = month.split("-").map(Number);
	const first = new Date(y, m - 1, 1);
	const offset = (first.getDay() + 6) % 7;
	const start = new Date(y, m - 1, 1 - offset);
	const weeks: { date: string; inMonth: boolean }[][] = [];
	const cursor = new Date(start);
	do {
		const week = [];
		for (let i = 0; i < 7; i++) {
			week.push({
				date: toIso(cursor),
				inMonth: cursor.getMonth() === m - 1,
			});
			cursor.setDate(cursor.getDate() + 1);
		}
		weeks.push(week);
	} while (cursor.getMonth() === m - 1);
	return weeks;
}

export function groupByDate(events: CalendarEvent[]) {
	const map = new Map<string, CalendarEvent[]>();
	for (const e of events) {
		const list = map.get(e.date);
		if (list) list.push(e);
		else map.set(e.date, [e]);
	}
	return map;
}

const dayFmt = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	month: "short",
	day: "numeric",
});

export function relativeDayLabel(date: string, today: string) {
	if (date === today) return "Today";
	const next = new Date(`${today}T00:00:00`);
	next.setDate(next.getDate() + 1);
	if (date === toIso(next)) return "Tomorrow";
	return dayFmt.format(new Date(`${date}T00:00:00`));
}
