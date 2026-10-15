"use client";

import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { DayPortion } from "@/lib/leave-policy";

interface DayPortionFieldProps {
	label: string;
	onChange: (value: DayPortion) => void;
	value: DayPortion;
}

export function DayPortionField({
	label,
	onChange,
	value,
}: DayPortionFieldProps) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			<Select
				value={value}
				onValueChange={(nextValue) => {
					if (nextValue) {
						onChange(nextValue as DayPortion);
					}
				}}
			>
				<SelectTrigger className="w-full">
					<SelectValue>
						{value === "full_day"
							? "Full Day"
							: value === "first_half"
								? "First Half"
								: "Second Half"}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="full_day">Full Day</SelectItem>
					<SelectItem value="first_half">First Half</SelectItem>
					<SelectItem value="second_half">Second Half</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
