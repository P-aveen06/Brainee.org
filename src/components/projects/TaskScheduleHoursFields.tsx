"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TaskScheduleHoursFieldsProps {
	startDate: string;
	onStartDateChange: (val: string) => void;
	dueDate: string;
	onDueDateChange: (val: string) => void;
	estimateHours: string;
	onEstimateHoursChange: (val: string) => void;
	actualHours: string;
	onActualHoursChange: (val: string) => void;
	showActualHours: boolean;
}

export function TaskScheduleHoursFields({
	startDate,
	onStartDateChange,
	dueDate,
	onDueDateChange,
	estimateHours,
	onEstimateHoursChange,
	actualHours,
	onActualHoursChange,
	showActualHours,
}: TaskScheduleHoursFieldsProps) {
	return (
		<>
			<div className="space-y-1.5">
				<Label htmlFor="startDate">Start Date</Label>
				<Input
					id="startDate"
					type="date"
					value={startDate}
					onChange={(e) => onStartDateChange(e.target.value)}
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="dueDate">Due Date</Label>
				<Input
					id="dueDate"
					type="date"
					value={dueDate}
					onChange={(e) => onDueDateChange(e.target.value)}
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="estHours">Estimated Hours</Label>
				<Input
					id="estHours"
					type="number"
					min="0"
					step="0.5"
					placeholder="e.g. 16"
					value={estimateHours}
					onChange={(e) => onEstimateHoursChange(e.target.value)}
				/>
			</div>

			{showActualHours && (
				<div className="space-y-1.5">
					<Label htmlFor="actHours">Actual Hours Spent</Label>
					<Input
						id="actHours"
						type="number"
						min="0"
						step="0.5"
						placeholder="e.g. 20"
						value={actualHours}
						onChange={(e) => onActualHoursChange(e.target.value)}
					/>
				</div>
			)}
		</>
	);
}
