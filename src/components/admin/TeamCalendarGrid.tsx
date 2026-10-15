"use client";

import { Link } from "@tanstack/react-router";
import {
	eachDayOfInterval,
	endOfMonth,
	format,
	isToday,
	isWeekend,
	startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTeamCalendarLive } from "#/api/admin";
import { useTeamCalendarRealtime } from "#/hooks/useRealtimeTables";
import type { TeamCalendarEmployee } from "#/lib/team-calendar-live-data.server";
import {
	DataTableActions,
	DataTableContainer,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, getInitials } from "@/lib/utils";
import { TeamCalendarDayCell } from "./TeamCalendarDayCell";
import { TeamCalendarLegend } from "./TeamCalendarLegend";

type TeamCalendarGridProps = {
	employees: TeamCalendarEmployee[];
	initialDate: Date;
};

export default function TeamCalendarGrid({
	employees,
	initialDate,
}: TeamCalendarGridProps) {
	const [currentDate, setCurrentDate] = useState(initialDate);
	const [liveEmployees, setLiveEmployees] = useState(employees);
	const calendarScrollRef = useRef<HTMLDivElement>(null);

	const refreshCalendar = useCallback(async () => {
		const data = await getTeamCalendarLive({ data: currentDate.toISOString() });
		if (data && !("error" in data)) {
			setLiveEmployees(data);
		}
	}, [currentDate]);

	useTeamCalendarRealtime(refreshCalendar);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when month changes
	useEffect(() => {
		const timer = setTimeout(() => {
			const scrollContainer = calendarScrollRef.current;
			const todayElement = scrollContainer?.querySelector<HTMLElement>(
				"[data-today-column]",
			);
			if (scrollContainer && todayElement) {
				scrollContainer.scrollTo({
					left: Math.max(
						0,
						todayElement.offsetLeft -
							(scrollContainer.clientWidth - todayElement.clientWidth) / 2,
					),
					behavior: "smooth",
				});
			}
		}, 100);
		return () => clearTimeout(timer);
	}, [currentDate]);

	const monthStart = startOfMonth(currentDate);
	const monthEnd = endOfMonth(currentDate);
	const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

	function prevMonth() {
		setCurrentDate(
			new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
		);
	}

	function nextMonth() {
		setCurrentDate(
			new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
		);
	}

	const gridStyle = {
		display: "grid",
		gridTemplateColumns: `200px repeat(${daysInMonth.length}, minmax(40px, 1fr))`,
		gap: "1px",
		backgroundColor: "color-mix(in srgb, var(--border) 45%, transparent)",
		minWidth: "max-content",
	};

	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
			<DataTableToolbar>
				<h2 className="font-heading text-base font-semibold tracking-tight">
					{format(currentDate, "MMMM yyyy")}
				</h2>
				<DataTableActions className="flex items-center gap-1.5">
					<Button
						variant="outline"
						size="sm"
						onClick={prevMonth}
						aria-label="Previous month"
						className="h-8 w-8 rounded-full p-0"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setCurrentDate(new Date())}
						className="h-8 rounded-full px-3 text-xs"
					>
						Today
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={nextMonth}
						aria-label="Next month"
						className="h-8 w-8 rounded-full p-0"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</DataTableActions>
			</DataTableToolbar>

			<DataTableContainer className="min-h-0 flex-1 p-0 [&>div]:h-full [&>div]:overflow-visible">
				<div
					ref={calendarScrollRef}
					className="h-full max-w-full overflow-auto"
				>
					<div style={gridStyle}>
						{/* Header row */}
						<div className="sticky top-0 left-0 z-30 flex items-center bg-card p-2 font-medium text-foreground shadow-[1px_1px_0_0_color-mix(in_srgb,var(--border)_80%,transparent)]">
							Employee
						</div>
						{daysInMonth.map((day) => {
							const isDayToday = isToday(day);
							return (
								<div
									key={day.toISOString()}
									data-today-column={isDayToday || undefined}
									className={cn(
										"sticky top-0 z-20 flex flex-col justify-center p-2 text-center text-xs shadow-[0_1px_0_0_color-mix(in_srgb,var(--border)_80%,transparent)]",
										isDayToday
											? "bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]"
											: isWeekend(day)
												? "bg-[color-mix(in_srgb,var(--card)_95%,var(--muted))]"
												: "bg-card",
									)}
								>
									<span
										className={cn(
											"font-medium",
											isDayToday && "text-accent font-bold",
										)}
									>
										{format(day, "d")}
									</span>
									<span
										className={cn(
											"text-muted-foreground",
											isDayToday && "text-accent/90 font-bold",
										)}
									>
										{format(day, "E")}
									</span>
									{isDayToday && (
										<span className="absolute top-1 right-1 flex h-1.5 w-1.5 rounded-full bg-accent" />
									)}
								</div>
							);
						})}

						{/* Employee rows */}
						{liveEmployees.map((employee) => (
							<div key={employee.id} className="contents group">
								<div className="sticky left-0 z-20 flex items-center gap-2 bg-card p-2 shadow-[1px_0_0_0_color-mix(in_srgb,var(--border)_45%,transparent)] transition-colors group-hover:bg-muted">
									<Avatar className="size-8 rounded-lg shrink-0">
										<AvatarImage src={employee.avatarUrl} />
										<AvatarFallback className="rounded-lg text-xs">
											{getInitials(employee.name)}
										</AvatarFallback>
									</Avatar>
									<div className="truncate min-w-0">
										<Link
											to="/admin/employees/$id"
											params={{ id: employee.id }}
											className="hover:underline hover:text-primary transition-colors block truncate"
										>
											<div className="text-sm font-medium truncate">
												{employee.name}
											</div>
										</Link>
										<div className="text-xs text-muted-foreground truncate">
											{employee.role.charAt(0).toUpperCase() +
												employee.role.slice(1)}
										</div>
									</div>
								</div>
								{daysInMonth.map((day) => (
									<TeamCalendarDayCell
										key={`${employee.id}-${day.toISOString()}`}
										day={day}
										employeeId={employee.id}
										events={employee.events}
									/>
								))}
							</div>
						))}
					</div>
				</div>
			</DataTableContainer>

			{/* Legend */}
			<div className="shrink-0">
				<TeamCalendarLegend />
			</div>
		</div>
	);
}
