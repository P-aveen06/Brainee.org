"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { teamCalendarStyles } from "./teamCalendarStyles";

function LegendItem({
	styleConfig,
	label,
}: {
	styleConfig: {
		icon?: React.ComponentType<{ className?: string }>;
		legend: string;
	};
	label: string;
}) {
	const Icon = styleConfig.icon;
	return (
		<div className="flex items-center gap-2">
			{Icon ? (
				<Icon
					className={cn(
						"h-4 w-4",
						styleConfig.legend
							.replace("bg-", "text-")
							.replace("border-", "text-"),
					)}
				/>
			) : (
				<div className={cn("h-3 w-3 rounded-full", styleConfig.legend)} />
			)}
			<span>{label}</span>
		</div>
	);
}

export function TeamCalendarLegend() {
	return (
		<div className="flex flex-wrap gap-x-6 gap-y-4 text-xs text-muted-foreground pt-6 border-t border-border">
			<LegendItem styleConfig={teamCalendarStyles.timesheet} label="Logged" />
			<LegendItem
				styleConfig={teamCalendarStyles.sickLeaveApproved}
				label="Sick Leave"
			/>
			<LegendItem
				styleConfig={teamCalendarStyles.personalLeaveApproved}
				label="Personal Leave"
			/>
			<LegendItem
				styleConfig={teamCalendarStyles.festivalLeaveApproved}
				label="Festival Leave"
			/>
			<LegendItem
				styleConfig={teamCalendarStyles.leaveApproved}
				label="Other Leave"
			/>
			<LegendItem
				styleConfig={teamCalendarStyles.leaveCancellationPending}
				label="Leave · cancelling (active)"
			/>
			<LegendItem styleConfig={teamCalendarStyles.wfhApproved} label="WFH" />
			<LegendItem styleConfig={teamCalendarStyles.holiday} label="Holiday" />
			<LegendItem
				styleConfig={teamCalendarStyles.reentry}
				label="Timesheet returned for correction"
			/>

			<div className="flex items-center gap-2">
				<Clock className="h-4 w-4 text-muted-foreground" />
				<span>Half-day indicator</span>
			</div>
		</div>
	);
}
