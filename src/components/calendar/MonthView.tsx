"use client";

import {
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DayCell } from "./DayCell";
import { DayDetailSheet } from "./DayDetailSheet";

type TimesheetEntry = {
	date: string;
	hours: number;
	status: string;
	re_entry_note: string | null;
};

type MonthViewProps = {
	timesheets: TimesheetEntry[];
	leaves: {
		leave_type?: string;
		start_date: string;
		end_date: string;
		status?: string;
		isHalfDayStart?: boolean;
		halfDayStartPeriod?: string | null;
		isHalfDayEnd?: boolean;
		halfDayEndPeriod?: string | null;
	}[];
	wfhs: {
		date: string;
		status?: string;
		isHalfDay?: boolean;
		halfDayPeriod?: string | null;
	}[];
	holidays: { date: string; name: string; year: number }[];
};

export function MonthView({
	timesheets,
	leaves,
	wfhs,
	holidays,
}: MonthViewProps) {
	const [currentDate, setCurrentDate] = useState(new Date());
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);

	const monthStart = startOfMonth(currentDate);
	const monthEnd = endOfMonth(currentDate);
	const startDate = startOfWeek(monthStart);
	const endDate = endOfWeek(monthEnd);
	const days = eachDayOfInterval({ start: startDate, end: endDate });

	const nextMonth = () =>
		setCurrentDate(
			new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
		);
	const prevMonth = () =>
		setCurrentDate(
			new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
		);

	const getDayDetails = (date: Date) => {
		const dateStr = format(date, "yyyy-MM-dd");
		const dateParts = dateStr.split("-");
		const targetMonth = dateParts[1];
		const targetDay = dateParts[2];

		return {
			ts: timesheets.find((t) => t.date === dateStr),
			wfh: wfhs.find((w) => w.date === dateStr),
			hol: holidays.find((h) => {
				if (h.year === 0) {
					const parts = h.date.split("-");
					const hMonth = parts[1];
					const hDay = parts[2];
					return hMonth === targetMonth && hDay === targetDay;
				}
				return h.date === dateStr;
			}),
			leave: leaves.find(
				(l) => dateStr >= l.start_date && dateStr <= l.end_date,
			),
		};
	};

	const selectedDetails = selectedDate ? getDayDetails(selectedDate) : null;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="font-heading text-base font-semibold tracking-tight">
					{format(currentDate, "MMMM yyyy")}
				</h2>
				<div className="flex gap-1.5">
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
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
				<div className="grid grid-cols-7 gap-px bg-border">
					{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
						<div
							key={day}
							className="bg-card px-2 py-2.5 text-center font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
						>
							{day}
						</div>
					))}
				</div>

				<div className="grid grid-cols-7 gap-px bg-border border-t border-border">
					{days.map((day) => {
						const { ts, wfh, hol, leave } = getDayDetails(day);
						const dateStr = format(day, "yyyy-MM-dd");

						let leavePortion = null;
						if (leave) {
							if (dateStr === leave.start_date && leave.isHalfDayStart) {
								leavePortion = leave.halfDayStartPeriod;
							} else if (dateStr === leave.end_date && leave.isHalfDayEnd) {
								leavePortion = leave.halfDayEndPeriod;
							}
						}

						let wfhPortion = null;
						if (wfh?.isHalfDay) {
							wfhPortion = wfh.halfDayPeriod;
						}

						return (
							<DayCell
								key={day.toISOString()}
								day={day}
								currentDate={currentDate}
								timesheet={ts}
								leave={leave}
								wfh={wfh}
								leavePortion={leavePortion}
								wfhPortion={wfhPortion}
								holidayName={hol?.name}
								onSelect={setSelectedDate}
							/>
						);
					})}
				</div>
			</div>

			<DayDetailSheet
				selectedDate={selectedDate}
				onClose={() => setSelectedDate(null)}
				timesheet={selectedDetails?.ts}
				leave={selectedDetails?.leave}
				wfh={selectedDetails?.wfh}
				holiday={selectedDetails?.hol}
			/>
		</div>
	);
}
