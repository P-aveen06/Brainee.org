import {
	CalendarOff,
	Home,
	PartyPopper,
	Stethoscope,
	Sun,
	TreePalm,
} from "lucide-react";
import type { TeamCalendarEvent } from "../../lib/team-calendar-live-data.server";

export const teamCalendarStyles = {
	timesheet: {
		cell: "border-status-logged-foreground/30 bg-status-logged text-status-logged-foreground hover:bg-status-logged-foreground/20",
		dot: "bg-status-logged-foreground",
		legend: "bg-status-logged-foreground",
	},
	leaveApproved: {
		cell: "border-status-leave-foreground/30 bg-status-leave text-status-leave-foreground hover:bg-status-leave-foreground/20",
		dot: "bg-status-leave-foreground",
		legend: "bg-status-leave-foreground",
		icon: CalendarOff,
	},
	leavePending: {
		cell: "border-status-leave-foreground/35 bg-status-leave/35 text-status-leave-foreground/80 hover:bg-status-leave-foreground/20 border-dashed",
		dot: "bg-status-leave-foreground/50 border border-status-leave-foreground/70",
		legend: "bg-transparent border-2 border-status-leave-foreground",
		icon: CalendarOff,
	},
	leaveCancellationPending: {
		cell: "border-status-leave-foreground/50 bg-status-leave/50 text-status-leave-foreground hover:bg-status-leave-foreground/25 border-dashed",
		dot: "bg-status-leave-foreground/70 border border-status-leave-foreground",
		legend:
			"bg-status-leave-foreground/40 border-2 border-dashed border-status-leave-foreground",
		icon: CalendarOff,
	},
	sickLeaveApproved: {
		cell: "border-status-sick-foreground/30 bg-status-sick text-status-sick-foreground hover:bg-status-sick-foreground/20",
		dot: "bg-status-sick-foreground",
		legend: "bg-status-sick-foreground",
		icon: Stethoscope,
	},
	sickLeavePending: {
		cell: "border-status-sick-foreground/35 bg-status-sick/35 text-status-sick-foreground/80 hover:bg-status-sick-foreground/20 border-dashed",
		dot: "bg-status-sick-foreground/50 border border-status-sick-foreground/70",
		legend: "bg-transparent border-2 border-status-sick-foreground",
		icon: Stethoscope,
	},
	sickLeaveCancellationPending: {
		cell: "border-status-sick-foreground/50 bg-status-sick/50 text-status-sick-foreground hover:bg-status-sick-foreground/25 border-dashed",
		dot: "bg-status-sick-foreground/70 border border-status-sick-foreground",
		legend:
			"bg-status-sick-foreground/40 border-2 border-dashed border-status-sick-foreground",
		icon: Stethoscope,
	},
	personalLeaveApproved: {
		cell: "border-status-personal-foreground/30 bg-status-personal text-status-personal-foreground hover:bg-status-personal-foreground/20",
		dot: "bg-status-personal-foreground",
		legend: "bg-status-personal-foreground",
		icon: Sun,
	},
	personalLeavePending: {
		cell: "border-status-personal-foreground/35 bg-status-personal/35 text-status-personal-foreground/80 hover:bg-status-personal-foreground/20 border-dashed",
		dot: "bg-status-personal-foreground/50 border border-status-personal-foreground/70",
		legend: "bg-transparent border-2 border-status-personal-foreground",
		icon: Sun,
	},
	personalLeaveCancellationPending: {
		cell: "border-status-personal-foreground/50 bg-status-personal/50 text-status-personal-foreground hover:bg-status-personal-foreground/25 border-dashed",
		dot: "bg-status-personal-foreground/70 border border-status-personal-foreground",
		legend:
			"bg-status-personal-foreground/40 border-2 border-dashed border-status-personal-foreground",
		icon: Sun,
	},
	festivalLeaveApproved: {
		cell: "border-status-festival-foreground/30 bg-status-festival text-status-festival-foreground hover:bg-status-festival-foreground/20",
		dot: "bg-status-festival-foreground",
		legend: "bg-status-festival-foreground",
		icon: PartyPopper,
	},
	festivalLeavePending: {
		cell: "border-status-festival-foreground/35 bg-status-festival/35 text-status-festival-foreground/80 hover:bg-status-festival-foreground/20 border-dashed",
		dot: "bg-status-festival-foreground/50 border border-status-festival-foreground/70",
		legend: "bg-transparent border-2 border-status-festival-foreground",
		icon: PartyPopper,
	},
	festivalLeaveCancellationPending: {
		cell: "border-status-festival-foreground/50 bg-status-festival/50 text-status-festival-foreground hover:bg-status-festival-foreground/25 border-dashed",
		dot: "bg-status-festival-foreground/70 border border-status-festival-foreground",
		legend:
			"bg-status-festival-foreground/40 border-2 border-dashed border-status-festival-foreground",
		icon: PartyPopper,
	},
	wfhApproved: {
		cell: "border-status-wfh-foreground/30 bg-status-wfh text-status-wfh-foreground hover:bg-status-wfh-foreground/20",
		dot: "bg-status-wfh-foreground",
		legend: "bg-status-wfh-foreground",
		icon: Home,
	},
	wfhPending: {
		cell: "border-status-wfh-foreground/35 bg-status-wfh/35 text-status-wfh-foreground/80 hover:bg-status-wfh-foreground/20 border-dashed",
		dot: "bg-status-wfh-foreground/50 border border-status-wfh-foreground/70",
		legend: "bg-transparent border-2 border-status-wfh-foreground",
		icon: Home,
	},
	holiday: {
		cell: "border-status-holiday-foreground/30 bg-status-holiday text-status-holiday-foreground hover:bg-status-holiday-foreground/20",
		dot: "bg-status-holiday-foreground",
		legend: "bg-status-holiday-foreground",
		icon: TreePalm,
	},
	reentry: {
		cell: "border-status-reentry-foreground/50 bg-status-reentry text-status-reentry-foreground hover:bg-status-reentry-foreground/20 border-2 font-medium",
		dot: "bg-status-reentry-foreground",
		legend: "bg-status-reentry-foreground",
	},
} as const;

export type DominantEventKey = keyof typeof teamCalendarStyles;

export function getTeamCalendarEventLabel(event: TeamCalendarEvent) {
	if (event.type === "timesheet" && event.status === "re_entry") {
		return "Needs Correction — Returned for Editing & Resubmission";
	}

	if (event.type === "leave" && event.status === "pending_cancellation") {
		return "Cancellation pending — leave remains active";
	}

	return {
		leave: "Leave",
		wfh: "WFH",
		holiday: "Holiday",
		timesheet: "Timesheet",
	}[event.type];
}

function getLeaveStyleKey(
	event: TeamCalendarEvent,
	base: "Approved" | "Pending" | "CancellationPending",
): DominantEventKey {
	const details = (event.details || "").toLowerCase();
	if (details.includes("sick")) return `sickLeave${base}` as DominantEventKey;
	if (details.includes("personal"))
		return `personalLeave${base}` as DominantEventKey;
	if (details.includes("festival") || details.includes("optional"))
		return `festivalLeave${base}` as DominantEventKey;
	return `leave${base}` as DominantEventKey;
}

export function getDominantEvent(
	events: TeamCalendarEvent[],
): DominantEventKey | null {
	if (events.some((e) => e.type === "holiday")) return "holiday";
	if (events.some((e) => e.status === "re_entry")) return "reentry";

	const approvedLeave = events.find(
		(e) => e.type === "leave" && e.status === "approved",
	);
	if (approvedLeave) return getLeaveStyleKey(approvedLeave, "Approved");

	const pendingCancellationLeave = events.find(
		(e) => e.type === "leave" && e.status === "pending_cancellation",
	);
	if (pendingCancellationLeave)
		return getLeaveStyleKey(pendingCancellationLeave, "CancellationPending");

	const pendingLeave = events.find(
		(e) => e.type === "leave" && e.status === "pending",
	);
	if (pendingLeave) return getLeaveStyleKey(pendingLeave, "Pending");

	if (events.some((e) => e.type === "wfh" && e.status === "approved"))
		return "wfhApproved";
	if (events.some((e) => e.type === "wfh" && e.status === "pending"))
		return "wfhPending";
	if (events.some((e) => e.type === "timesheet")) return "timesheet";
	return null;
}
