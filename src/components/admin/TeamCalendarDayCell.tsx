"use client";

import { format, isToday, isWeekend } from "date-fns";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateDisplay } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import type { TeamCalendarEvent } from "../../lib/team-calendar-live-data.server";
import {
	getDominantEvent,
	getTeamCalendarEventLabel,
	teamCalendarStyles,
} from "./teamCalendarStyles";

interface TeamCalendarDayCellProps {
	day: Date;
	employeeId: string;
	events: TeamCalendarEvent[];
}

export function TeamCalendarDayCell({
	day,
	employeeId,
	events,
}: TeamCalendarDayCellProps) {
	const dateStr = format(day, "yyyy-MM-dd");

	// Filter events active for this specific date
	const dayEvents = events.filter(
		(e) =>
			(e.date === dateStr ||
				(e.date.startsWith(dateStr) && e.type === "timesheet")) &&
			e.status !== "rejected" &&
			e.status !== "revoked" &&
			e.status !== "cancelled" &&
			e.status !== "pending",
	);

	const isWknd = isWeekend(day);
	const dominantType = getDominantEvent(dayEvents);
	const isDayToday = isToday(day);

	const timesheetEvent = dayEvents.find((e) => e.type === "timesheet");
	const halfDayEvent = dayEvents.find(
		(e) => e.portion === "first_half" || e.portion === "second_half",
	);

	const styleConfig = dominantType ? teamCalendarStyles[dominantType] : null;

	const allIcons = dayEvents
		.filter((e) => e.type !== "timesheet")
		.map((e) => {
			const key = getDominantEvent([e]);
			const config = key ? teamCalendarStyles[key] : null;
			return {
				id: e.id,
				Icon: config && "icon" in config ? config.icon : null,
			};
		})
		.filter(
			(item, index, self) =>
				item.Icon && self.findIndex((x) => x.Icon === item.Icon) === index,
		);

	const textColor = styleConfig?.cell
		?.split(/\s+/)
		.find((c) => c.startsWith("text-"));

	return (
		<Popover key={`${employeeId}-${dateStr}`}>
			<PopoverTrigger
				render={
					<button
						type="button"
						className={cn(
							"flex min-h-[40px] cursor-pointer items-center justify-center p-1 transition-colors hover:bg-muted relative overflow-hidden",
							!dominantType && (isWknd ? "bg-weekend" : "bg-card"),
							isDayToday && "bg-primary/5",
							dominantType && !halfDayEvent && styleConfig?.cell,
							dominantType &&
								halfDayEvent &&
								(isWknd ? "bg-weekend" : "bg-card"),
							dominantType && halfDayEvent && textColor,
						)}
					>
						{dominantType && halfDayEvent && (
							<div
								className={cn(
									"absolute inset-0 z-0",
									styleConfig?.cell,
									halfDayEvent.portion === "first_half"
										? "[clip-path:polygon(0_0,50%_0,50%_100%,0_100%)]"
										: "[clip-path:polygon(50%_0,100%_0,100%_100%,50%_100%)]",
								)}
							/>
						)}

						<div className="relative z-10 flex items-center justify-center gap-0.5">
							{allIcons.map(({ id, Icon }) =>
								Icon ? (
									<Icon
										key={id}
										className={cn(
											"opacity-80",
											timesheetEvent || allIcons.length > 1
												? "h-3.5 w-3.5"
												: "h-4 w-4",
										)}
									/>
								) : null,
							)}
							{timesheetEvent && timesheetEvent.hours !== undefined && (
								<span className="text-xs font-semibold">
									{timesheetEvent.hours}h
								</span>
							)}
							{allIcons.length === 0 &&
								!timesheetEvent &&
								dayEvents.length > 0 &&
								dominantType && (
									<div
										className={cn("h-2.5 w-2.5 rounded-full", styleConfig?.dot)}
									/>
								)}
						</div>
					</button>
				}
			/>
			{dayEvents.length > 0 && (
				<PopoverContent className="w-64 p-3" align="center">
					<div className="space-y-2 text-sm">
						<p className="font-medium text-muted-foreground mb-2">
							{formatDateDisplay(day)}
						</p>
						{dayEvents.map((event) => (
							<div
								key={`${event.id}-${event.type}-${event.date}`}
								className="flex flex-col gap-1 border-b pb-2 last:border-0 last:pb-0"
							>
								<div className="flex items-center justify-between">
									<span className="font-medium">
										{getTeamCalendarEventLabel(event)}
									</span>
									<Badge variant="outline">{event.status}</Badge>
								</div>
								{(event.details ||
									(event.portion && event.portion !== "full_day")) && (
									<span className="text-xs text-muted-foreground flex items-center">
										{event.details}
										{event.portion && event.portion !== "full_day" && (
											<span
												className={cn(
													"inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium",
													event.details ? "ml-2" : "",
												)}
											>
												<Clock className="h-3 w-3" />
												{event.portion === "first_half"
													? "1st Half"
													: "2nd Half"}
											</span>
										)}
									</span>
								)}
							</div>
						))}
					</div>
				</PopoverContent>
			)}
		</Popover>
	);
}
