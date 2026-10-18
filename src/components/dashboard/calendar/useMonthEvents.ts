import { useCallback, useEffect, useRef, useState } from "react";
import { getDashboardCalendar } from "#/api/dashboard-extras";
import type { CalendarEvent } from "#/lib/dashboard-calendar.server";

/** Month-keyed event cache. Seeded from the loader so the first paint needs no fetch. */
export function useMonthEvents(initial: {
	month: string;
	events: CalendarEvent[];
}) {
	const [cache, setCache] = useState<Record<string, CalendarEvent[]>>({
		[initial.month]: initial.events,
	});
	const [loading, setLoading] = useState(false);
	const [failed, setFailed] = useState(false);
	const requested = useRef(new Set([initial.month]));

	// The loader re-runs on router.invalidate(); keep its month fresh.
	useEffect(() => {
		setCache((c) => ({ ...c, [initial.month]: initial.events }));
	}, [initial.month, initial.events]);

	const ensure = useCallback(async (month: string) => {
		if (requested.current.has(month)) return;
		requested.current.add(month);
		setLoading(true);
		setFailed(false);
		try {
			const res = await getDashboardCalendar({ data: month });
			if (!res || !Array.isArray(res.events)) {
				throw new Error("Calendar response did not include events");
			}
			setCache((c) => ({ ...c, [month]: res.events }));
		} catch {
			requested.current.delete(month);
			setFailed(true);
		} finally {
			setLoading(false);
		}
	}, []);

	return { cache, loading, failed, ensure };
}
