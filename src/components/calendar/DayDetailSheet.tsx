"use client";

import { format } from "date-fns";
import {
	AlertTriangle,
	Calendar as CalendarIcon,
	Clock,
	Home,
	Umbrella,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PillToggle } from "@/components/ui/pill-toggle";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { formatDateDisplay } from "@/lib/date-format";
import { InlineTimesheetForm } from "./InlineTimesheetForm";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { WfhRequestForm } from "./WfhRequestSheet";

type TimesheetEntry = {
	date: string;
	hours: number;
	status: string;
	re_entry_note: string | null;
};

type DayDetailSheetProps = {
	selectedDate: Date | null;
	onClose: () => void;
	timesheet?: TimesheetEntry;
	leave?: { start_date: string; end_date: string; status?: string };
	wfh?: { date: string; status?: string };
	holiday?: { date: string; name: string };
};

function getLeaveStatusLabel(status?: string) {
	if (status === "pending_cancellation") {
		return "Cancellation pending — leave remains active";
	}

	return status || "Approved";
}

export function DayDetailSheet({
	selectedDate,
	onClose,
	timesheet,
	leave,
	wfh,
	holiday,
}: DayDetailSheetProps) {
	const [activeActionState, setActiveAction] = useState("log");
	const isWeekend = selectedDate
		? selectedDate.getDay() === 0 || selectedDate.getDay() === 6
		: false;

	const activeAction = isWeekend ? "log" : activeActionState;

	const isReentry = timesheet?.status === "re_entry";
	const selectedDateIso = selectedDate
		? format(selectedDate, "yyyy-MM-dd")
		: "";
	const canLogHours =
		!!selectedDate && selectedDate <= new Date() && !leave && !holiday;

	return (
		<Sheet open={!!selectedDate} onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="sm:max-w-md">
				{selectedDate && (
					<>
						<SheetHeader>
							<SheetTitle className="text-lg font-semibold flex items-center gap-2">
								<CalendarIcon
									className="w-5 h-5 text-muted-foreground"
									aria-hidden="true"
								/>
								{format(selectedDate, "EEEE")},{" "}
								{formatDateDisplay(selectedDate)}
							</SheetTitle>
							<SheetDescription>
								Details and actions for this day.
							</SheetDescription>
						</SheetHeader>

						<SheetBody className="flex flex-col gap-4">
							{isReentry && timesheet?.re_entry_note && (
								<Alert variant="destructive">
									<AlertTriangle className="h-4 w-4" />
									<AlertTitle>
										Needs Correction — Returned for Editing &amp; Resubmission
									</AlertTitle>
									<AlertDescription>{timesheet.re_entry_note}</AlertDescription>
								</Alert>
							)}

							{holiday && (
								<div className="p-4 border rounded-xl bg-status-holiday/30 border-status-holiday flex flex-col gap-1">
									<span className="text-sm font-semibold text-status-holiday-foreground">
										Public Holiday
									</span>
									<span className="text-sm text-foreground">
										{holiday.name}
									</span>
								</div>
							)}

							{leave ? (
								<div className="p-4 border rounded-xl bg-status-leave/30 border-status-leave flex flex-col gap-1">
									<div className="flex items-center gap-2 text-sm font-semibold text-status-leave-foreground">
										<Umbrella className="w-4 h-4" aria-hidden="true" />
										On Leave
									</div>
									<span className="text-sm text-foreground">
										Status:{" "}
										<span className="capitalize">
											{getLeaveStatusLabel(leave.status)}
										</span>
									</span>
								</div>
							) : wfh ? (
								<div className="p-4 border rounded-xl bg-status-wfh/30 border-status-wfh flex flex-col gap-1">
									<div className="flex items-center gap-2 text-sm font-semibold text-status-wfh-foreground">
										<Home className="w-4 h-4" aria-hidden="true" />
										WFH
									</div>
									<span className="text-sm text-foreground">
										Status:{" "}
										<span className="capitalize">
											{getLeaveStatusLabel(wfh.status)}
										</span>
									</span>
								</div>
							) : null}

							<div className="space-y-3 pt-2">
								{!isWeekend && (
									<PillToggle
										value={activeAction}
										onChange={setActiveAction}
										items={[
											{
												value: "log",
												label: (
													<span className="flex items-center gap-1.5">
														<Clock className="h-3.5 w-3.5" aria-hidden="true" />
														Log Hour
													</span>
												),
											},
											{
												value: "leave",
												label: (
													<span className="flex items-center gap-1.5">
														<Umbrella
															className="h-3.5 w-3.5"
															aria-hidden="true"
														/>
														Leave
													</span>
												),
											},
											{
												value: "wfh",
												label: (
													<span className="flex items-center gap-1.5">
														<Home className="h-3.5 w-3.5" aria-hidden="true" />
														WFH
													</span>
												),
											},
										]}
									/>
								)}

								{activeAction === "log" && (
									<>
										{isWeekend && (
											<div className="p-6 border rounded-2xl bg-status-pending border-warning/20 flex flex-col items-center justify-center text-center gap-3 py-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
												<div className="size-12 rounded-full bg-warning/15 flex items-center justify-center text-2xl animate-bounce">
													🌴
												</div>
												<div className="space-y-1">
													<h3 className="font-heading font-medium text-lg text-foreground">
														Happy Weekend! 🎉
													</h3>
													<p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
														Saturdays and Sundays are rest days. Leave and WFH
														requests cannot be applied.
													</p>
												</div>
											</div>
										)}
										{timesheet ? (
											<div
												className={`p-4 border rounded-xl flex flex-col gap-2 ${
													isReentry
														? "bg-status-reentry/30 border-status-reentry"
														: "bg-status-logged/30 border-status-logged"
												}`}
											>
												<div
													className={`flex items-center gap-2 text-sm font-semibold ${
														isReentry
															? "text-status-reentry-foreground"
															: "text-status-logged-foreground"
													}`}
												>
													<Clock className="w-4 h-4" aria-hidden="true" />
													{isReentry
														? "Timesheet Needs Correction — Returned for Editing"
														: "Timesheet Logged"}
												</div>
												<span className="text-sm text-foreground">
													{timesheet.hours} hours logged for this day.
												</span>
												{selectedDate <= new Date() && (
													<InlineTimesheetForm
														date={selectedDateIso}
														defaultHours={timesheet.hours}
													/>
												)}
											</div>
										) : (
											<div className="p-4 border border-dashed rounded-xl flex flex-col items-center justify-center gap-3 py-8 text-center bg-muted/10">
												<Clock
													className="w-8 h-8 text-muted-foreground/50"
													aria-hidden="true"
												/>
												<p className="text-sm font-medium text-muted-foreground">
													No hours logged
												</p>
												{canLogHours ? (
													<InlineTimesheetForm date={selectedDateIso} />
												) : (
													<p className="text-xs text-muted-foreground">
														Hours can be logged for working days up to today.
													</p>
												)}
											</div>
										)}
									</>
								)}

								{activeAction === "leave" && (
									<div className="rounded-xl border bg-muted/10 p-4">
										<LeaveRequestForm
											key={`leave-form-${selectedDateIso}`}
											initialDate={selectedDateIso}
										/>
									</div>
								)}

								{activeAction === "wfh" && (
									<div className="rounded-xl border bg-muted/10 p-4">
										<WfhRequestForm
											key={`wfh-form-${selectedDateIso}`}
											initialDate={selectedDateIso}
										/>
									</div>
								)}
							</div>
						</SheetBody>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}
