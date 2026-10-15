"use client";

import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import {
	useRequestRealtime,
	useTeamCalendarRealtime,
} from "@/hooks/useRealtimeTables";

export function CalendarRealtimeRefresh() {
	const router = useRouter();
	const refresh = useCallback(() => {
		router.invalidate();
	}, [router]);

	useRequestRealtime(refresh);
	useTeamCalendarRealtime(refresh);

	return null;
}
