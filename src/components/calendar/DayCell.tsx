"use client";

import { format, isSameMonth, isToday, isWeekend } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { formatDateDisplay } from "@/lib/date-format";

type TimesheetEntry = {
	date: string;
	hours: number;
	status: string;
	re_entry_note: string | null;
};

type DayCellProps = {
	day: Date;
	currentDate: Date;
	timesheet?: TimesheetEntry;
	leave?: {
		status?: string;
		leave_type?: string;
	};
	wfh?: { status?: string };
	leavePortion?: string | null;
	wfhPortion?: string | null;
	holidayName?: string;
	onSelect: (day: Date) => void;
};

export function DayCell({
	day,
	currentDate,
	timesheet,
	leave,
	wfh,
	leavePortion,
	wfhPortion,
	holidayName,
	onSelect,
}: DayCellProps) {
	const isCurrentMonth = isSameMonth(day, currentDate);
	const isReentry = timesheet?.status === "re_entry";

	const getLeaveTypeName = (slug?: string) => {
		if (!slug) return "Leave";
		const parts = slug.split("-");
		return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
	};

	const formatPortion = (portion?: string | null) => {
		if (portion === "first_half") return "(1st Half)";
		if (portion === "second_half") return "(2nd Half)";
		return "";
	};

	return (
		<button
			type="button"
			onClick={() => onSelect(day)}
			aria-label={`${formatDateDisplay(day)}${timesheet ? `, ${timesheet.hours} hours logged` : ""}${holidayName ? `, holiday: ${holidayName}` : ""}`}
			className={`min-h-[76px] cursor-pointer p-1.5 text-left transition-colors hover:bg-secondary active:bg-muted focus-visible:outline-2 focus-visible:outline-ring md:min-h-[82px] ${
				!isCurrentMonth ? "text-muted-foreground opacity-40" : ""
			} ${isWeekend(day) ? "bg-weekend" : "bg-card"}`}
		>
			<div className="flex justify-between items-start">
				<span
					className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
						isToday(day) ? "bg-primary text-primary-foreground" : ""
					}`}
				>
					{format(day, "d")}
				</span>
				{timesheet && (
					<Badge
						variant="outline"
						className={
							isReentry
								? "border-0 bg-status-reentry px-1.5 py-0 text-[10px] text-status-reentry-foreground"
								: "border-0 bg-status-logged px-1.5 py-0 text-[10px] text-status-logged-foreground"
						}
					>
						{timesheet.hours}h
					</Badge>
				)}
			</div>

			<div className="mt-1.5 space-y-1">
				{holidayName && (
					<div
						className="text-[10px] bg-status-holiday text-status-holiday-foreground px-1.5 py-0.5 rounded truncate font-medium"
						title={holidayName}
					>
						{holidayName}
					</div>
				)}
				{leave && (
					<div
						className={`text-[10px] ${leave.status === "pending" ? "bg-muted border border-dashed border-status-leave-foreground text-status-leave-foreground" : "bg-status-leave text-status-leave-foreground"} px-1.5 py-0.5 rounded truncate font-medium`}
						title={
							leave.status === "pending"
								? `${getLeaveTypeName(leave.leave_type)} (Applied)`
								: getLeaveTypeName(leave.leave_type)
						}
					>
						{getLeaveTypeName(leave.leave_type)} {formatPortion(leavePortion)}{" "}
						{leave.status === "pending" && "(Applied)"}
					</div>
				)}
				{wfh && (
					<div
						className={`text-[10px] ${wfh.status === "pending" ? "bg-muted border border-dashed border-status-wfh-foreground text-status-wfh-foreground" : "bg-status-wfh text-status-wfh-foreground"} px-1.5 py-0.5 rounded truncate font-medium`}
						title={wfh.status === "pending" ? "WFH (Applied)" : "WFH"}
					>
						WFH {formatPortion(wfhPortion)}{" "}
						{wfh.status === "pending" && "(Applied)"}
					</div>
				)}
			</div>
		</button>
	);
}
