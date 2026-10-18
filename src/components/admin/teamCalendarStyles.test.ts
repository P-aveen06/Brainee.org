import { describe, expect, it } from "vitest";
import {
	getDominantEvent,
	getTeamCalendarEventLabel,
} from "./teamCalendarStyles";

describe("team calendar event presentation", () => {
	it("keeps a cancellation-pending leave visibly active", () => {
		const event = {
			id: "leave-1",
			type: "leave" as const,
			date: "2026-10-16",
			status: "pending_cancellation",
		};

		expect(getDominantEvent([event])).toBe("leaveCancellationPending");
		expect(getTeamCalendarEventLabel(event)).toBe(
			"Cancellation pending — leave remains active",
		);
	});

	it("explains when a timesheet needs correction", () => {
		expect(
			getTeamCalendarEventLabel({
				id: "timesheet-1",
				type: "timesheet",
				date: "2026-10-16",
				status: "re_entry",
			}),
		).toBe("Needs Correction — Returned for Editing & Resubmission");
	});

	it("uses readable labels for ordinary calendar events", () => {
		expect(
			getTeamCalendarEventLabel({
				id: "wfh-1",
				type: "wfh",
				date: "2026-10-16",
				status: "approved",
			}),
		).toBe("WFH");
		expect(
			getTeamCalendarEventLabel({
				id: "leave-2",
				type: "leave",
				date: "2026-10-16",
				status: "approved",
			}),
		).toBe("Leave");
	});
});
