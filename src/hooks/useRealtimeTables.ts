import { useEffect } from "react";

type RealtimeTable =
	| "leave_requests"
	| "wfh_requests"
	| "timesheets"
	| "public_holidays"
	| "users";

type UseRealtimeTablesOptions = {
	tables: readonly RealtimeTable[];
	channelPrefix: string;
	onChange: () => void;
};

export function useRealtimeTables({ onChange }: UseRealtimeTablesOptions) {
	useEffect(() => {
		// Polling interval of 10 seconds as a fallback for collaborative updates
		const timer = setInterval(() => {
			onChange();
		}, 10000);

		return () => clearInterval(timer);
	}, [onChange]);
}

export function useRequestRealtime(onChange: () => void) {
	useRealtimeTables({
		tables: ["leave_requests", "wfh_requests"] as const,
		channelPrefix: "requests",
		onChange,
	});
}

export function useTeamCalendarRealtime(onChange: () => void) {
	useRealtimeTables({
		tables: [
			"timesheets",
			"leave_requests",
			"wfh_requests",
			"public_holidays",
			"users",
		] as const,
		channelPrefix: "team-calendar",
		onChange,
	});
}
