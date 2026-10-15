"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProjectScheduleFieldsProps {
	startDate: string;
	onStartDateChange: (v: string) => void;
	targetEndDate: string;
	onTargetEndDateChange: (v: string) => void;
}

export function ProjectScheduleFields({
	startDate,
	onStartDateChange,
	targetEndDate,
	onTargetEndDateChange,
}: ProjectScheduleFieldsProps) {
	return (
		<div className="space-y-3.5 pt-2 border-t border-border">
			<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
				Timeline & Schedule
			</h4>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
				<div className="space-y-1.5">
					<Label htmlFor="startDate">Target Start Date</Label>
					<Input
						id="startDate"
						type="date"
						value={startDate}
						onChange={(e) => onStartDateChange(e.target.value)}
					/>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="targetEndDate">Target Delivery / Completion</Label>
					<Input
						id="targetEndDate"
						type="date"
						value={targetEndDate}
						onChange={(e) => onTargetEndDateChange(e.target.value)}
					/>
				</div>
			</div>
		</div>
	);
}
