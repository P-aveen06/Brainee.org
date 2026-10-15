"use client";

import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateDisplay } from "@/lib/date-format";
import { cn } from "@/lib/utils";

type DatePickerProps = {
	id?: string;
	name?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
};

function isoToDate(value: string) {
	const parsed = parse(value, "yyyy-MM-dd", new Date());
	return isValid(parsed) ? parsed : undefined;
}

function dateToIso(value: Date) {
	return format(value, "yyyy-MM-dd");
}

export function DatePicker({
	id,
	name,
	value,
	onChange,
	placeholder = "dd-mm-yyyy",
	disabled,
	className,
}: DatePickerProps) {
	const selectedDate = value ? isoToDate(value) : undefined;

	return (
		<div className={cn("relative z-20", className)}>
			{name && <input type="hidden" name={name} value={value} />}
			<Popover>
				<PopoverTrigger
					render={
						<Button
							id={id}
							type="button"
							variant="outline"
							disabled={disabled}
							className={cn(
								"h-10 w-full justify-start px-3 text-left font-normal",
								!value && "text-muted-foreground",
							)}
						/>
					}
				>
					<CalendarIcon className="size-4 text-muted-foreground" />
					<span>{value ? formatDateDisplay(value) : placeholder}</span>
				</PopoverTrigger>
				<PopoverContent
					className="w-auto bg-popover p-0 shadow-xl"
					align="start"
					sideOffset={8}
				>
					<Calendar
						mode="single"
						selected={selectedDate}
						onSelect={(date) => {
							if (date) onChange(dateToIso(date));
						}}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
