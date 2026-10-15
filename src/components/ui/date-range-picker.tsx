"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type * as React from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateDisplay } from "@/lib/date-format";
import { cn } from "@/lib/utils";

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
	date: DateRange | undefined;
	setDate: (date: DateRange | undefined) => void;
	className?: string;
	disabled?: boolean;
}

export function DateRangePicker({
	className,
	date,
	setDate,
	disabled,
}: DateRangePickerProps) {
	return (
		<div className={cn("grid gap-2", className)}>
			<Popover>
				<PopoverTrigger
					render={
						<Button
							id="date"
							type="button"
							variant={"outline"}
							className={cn(
								"w-full justify-start px-3 text-left font-normal",
								!date && "text-muted-foreground",
							)}
							disabled={disabled}
						/>
					}
				>
					<CalendarIcon className="size-4 text-muted-foreground" />
					<span>
						{date?.from ? (
							date.to ? (
								<>
									{formatDateDisplay(format(date.from, "yyyy-MM-dd"))} -{" "}
									{formatDateDisplay(format(date.to, "yyyy-MM-dd"))}
								</>
							) : (
								formatDateDisplay(format(date.from, "yyyy-MM-dd"))
							)
						) : (
							"Pick a date range"
						)}
					</span>
				</PopoverTrigger>
				<PopoverContent
					className="w-auto bg-popover p-0 shadow-xl"
					align="start"
				>
					<Calendar
						autoFocus
						mode="range"
						defaultMonth={date?.from}
						selected={date}
						onSelect={setDate}
						numberOfMonths={2}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
