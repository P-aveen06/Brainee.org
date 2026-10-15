"use client";

import { CalendarDays, ClipboardList } from "lucide-react";
import { type ReactNode, useState } from "react";
import { PageTabs } from "@/components/ui/page-tabs";

type CalendarPageTabsProps = {
	calendar: ReactNode;
	requests: ReactNode;
};

export function CalendarPageTabs({
	calendar,
	requests,
}: CalendarPageTabsProps) {
	const [tab, setTab] = useState("calendar");

	return (
		<div className="space-y-6">
			<PageTabs
				value={tab}
				onChange={setTab}
				items={[
					{
						value: "calendar",
						label: (
							<span className="flex items-center gap-1.5">
								<CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
								My Calendar
							</span>
						),
					},
					{
						value: "requests",
						label: (
							<span className="flex items-center gap-1.5">
								<ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
								My Requests
							</span>
						),
					},
				]}
				ariaLabel="Attendance sections"
			/>

			{tab === "calendar" ? calendar : requests}
		</div>
	);
}
