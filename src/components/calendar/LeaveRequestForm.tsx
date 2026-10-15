"use client";

import { useRouter } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useState, useTransition } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { applyForLeave, getInitialLeaveRequestData } from "#/api/leaves";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	calculateBusinessLeaveDays,
	calculateWorkingDaysInAdvance,
	type DayPortion,
	formatLeaveType,
	getTodayIsoDate,
} from "@/lib/leave-policy";
import { DayPortionField } from "./DayPortionField";

type SystemLeaveType = {
	id: string;
	name: string;
	slug: string;
	apply_before_days?: number | null;
	apply_before_days_extended?: number | null;
	extended_limit_trigger?: number | null;
};

type LeaveRequestFormProps = {
	initialDate?: string;
	className?: string;
};

function getInitialDateRange(initialDate?: string): DateRange {
	const date = initialDate ? new Date(`${initialDate}T00:00:00`) : new Date();
	return { from: date, to: date };
}

export function LeaveRequestForm({
	initialDate,
	className = "space-y-4",
}: LeaveRequestFormProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const [leaveTypes, setLeaveTypes] = useState<SystemLeaveType[]>([]);
	const [leaveType, setLeaveType] = useState<string>("");
	const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
		getInitialDateRange(initialDate),
	);
	const [startPortion, setStartPortion] = useState<DayPortion>("full_day");
	const [endPortion, setEndPortion] = useState<DayPortion>("full_day");
	const [holidays, setHolidays] = useState<string[]>([]);

	const startDateIso = dateRange?.from
		? format(dateRange.from, "yyyy-MM-dd")
		: getTodayIsoDate();
	const endDateIso = dateRange?.to
		? format(dateRange.to, "yyyy-MM-dd")
		: startDateIso;

	useEffect(() => {
		async function fetchTypes() {
			const data = await getInitialLeaveRequestData();
			if (data) {
				if (data.leaveTypes) {
					setLeaveTypes(data.leaveTypes);
					if (data.leaveTypes.length > 0) setLeaveType(data.leaveTypes[0].slug);
				}

				if (data.holidays) {
					const hDates: string[] = [];
					const currentYear = new Date().getFullYear();
					data.holidays.forEach((h) => {
						if (h.year === 0) {
							const parts = h.date.split("-");
							hDates.push(`${currentYear}-${parts[1]}-${parts[2]}`);
							hDates.push(`${currentYear + 1}-${parts[1]}-${parts[2]}`);
						} else {
							hDates.push(h.date);
						}
					});
					setHolidays(hDates);
				}
			}
		}
		fetchTypes();
	}, []);

	const supportsHalfDay = true;
	const isSingleDay = startDateIso === endDateIso;

	const handleLeaveTypeChange = (value: string | null) => {
		if (!value) return;
		setLeaveType(value);
	};

	const isReasonRequired =
		leaveType === "sick-leave" ||
		leaveType === "sick_leave" ||
		leaveType === "festival-leave" ||
		leaveType === "festival_leave";

	const handleSubmit = async (formData: FormData) => {
		setError(null);
		const reasonText = (formData.get("reason")?.toString() || "").trim();
		if (isReasonRequired && !reasonText) {
			const reqError = "Reason is required for Sick Leave and Festival Leave.";
			setError(reqError);
			toast.error("Leave request failed", { description: reqError });
			return;
		}

		startTransition(async () => {
			const result = await applyForLeave({
				data: {
					leave_type: leaveType,
					start_date: startDateIso,
					end_date: endDateIso,
					start_day_portion: startPortion,
					end_day_portion:
						startDateIso === endDateIso ? "full_day" : endPortion,
					reason: reasonText,
				},
			});
			if (result.error) {
				setError(result.error);
				toast.error("Leave request failed", { description: result.error });
				return;
			}

			toast.success("Leave request submitted");
			router.invalidate();
			setStartPortion("full_day");
			setEndPortion("full_day");
		});
	};

	const selectedLeaveTypeInfo = leaveTypes.find((t) => t.slug === leaveType);

	const totalDays = calculateBusinessLeaveDays({
		startDate: startDateIso,
		endDate: endDateIso,
		startDayPortion: startPortion,
		endDayPortion: startDateIso === endDateIso ? "full_day" : endPortion,
		holidayDates: holidays,
	});

	let violationMessage: string | null = null;
	if (selectedLeaveTypeInfo) {
		const applyBeforeDays = selectedLeaveTypeInfo.apply_before_days ?? 0;
		const applyBeforeDaysExt =
			selectedLeaveTypeInfo.apply_before_days_extended ?? 0;
		const extTrigger = selectedLeaveTypeInfo.extended_limit_trigger ?? 0;

		if (applyBeforeDays > 0 || (extTrigger > 0 && applyBeforeDaysExt > 0)) {
			const todayIso = getTodayIsoDate();
			const advanceWorkingDays = calculateWorkingDaysInAdvance(
				startDateIso,
				todayIso,
				holidays,
			);
			const isExtended = extTrigger > 0 && totalDays >= extTrigger;
			const requiredAdvance = isExtended ? applyBeforeDaysExt : applyBeforeDays;

			if (advanceWorkingDays < requiredAdvance) {
				violationMessage = `Applying ${advanceWorkingDays} working days in advance. Requires ${requiredAdvance} working days notice.`;
			}
		}
	}

	return (
		<form action={handleSubmit} className={className}>
			<input type="hidden" name="leave_type" value={leaveType} />
			<input type="hidden" name="start_day_portion" value={startPortion} />
			<input type="hidden" name="end_day_portion" value={endPortion} />

			{error && <div className="text-sm text-destructive">{error}</div>}

			<div className="space-y-2">
				<Label>Leave Type</Label>
				<Select
					value={leaveType}
					onValueChange={handleLeaveTypeChange}
					disabled={leaveTypes.length === 0}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Loading types...">
							{selectedLeaveTypeInfo
								? formatLeaveType(selectedLeaveTypeInfo.name)
								: "Loading..."}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{leaveTypes.map((type) => (
							<SelectItem key={type.slug} value={type.slug}>
								{formatLeaveType(type.name)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{selectedLeaveTypeInfo && (
					<div className="mt-1.5 text-xs text-muted-foreground px-0.5">
						{selectedLeaveTypeInfo.apply_before_days ? (
							<span>
								Rule: Requires {selectedLeaveTypeInfo.apply_before_days} working
								days advance notice
								{selectedLeaveTypeInfo.extended_limit_trigger ? (
									<span>
										{" "}
										({selectedLeaveTypeInfo.apply_before_days_extended} working
										days if leave is ≥{" "}
										{selectedLeaveTypeInfo.extended_limit_trigger} days)
									</span>
								) : null}
								.
							</span>
						) : (
							<span>Rule: No advance notice required.</span>
						)}
					</div>
				)}

				{violationMessage && (
					<div
						className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive mt-2 animate-in fade-in slide-in-from-top-1 duration-150"
						role="alert"
					>
						<span className="font-semibold block mb-0.5">
							⚠️ Advance-notice policy
						</span>
						{violationMessage}
					</div>
				)}
			</div>

			<input type="hidden" name="start_date" value={startDateIso} />
			<input type="hidden" name="end_date" value={endDateIso} />

			<div className="space-y-2">
				<Label>Leave Dates</Label>
				<DateRangePicker date={dateRange} setDate={setDateRange} />
			</div>

			{supportsHalfDay && (
				<>
					<DayPortionField
						label="Start Day Portion"
						value={startPortion}
						onChange={setStartPortion}
					/>
					{!isSingleDay && (
						<DayPortionField
							label="End Day Portion"
							value={endPortion}
							onChange={setEndPortion}
						/>
					)}
				</>
			)}

			<div className="space-y-2">
				<Label htmlFor="leave_reason">
					{isReasonRequired ? "Reason (Required)" : "Reason (Optional)"}
				</Label>
				<Input
					id="leave_reason"
					name="reason"
					maxLength={500}
					required={isReasonRequired}
					placeholder={
						isReasonRequired
							? "Enter reason for leave..."
							: "Optional reason..."
					}
				/>
			</div>

			<Button type="submit" className="w-full" disabled={isPending}>
				{isPending ? "Submitting..." : "Submit Request"}
			</Button>
		</form>
	);
}
