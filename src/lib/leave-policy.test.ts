import { describe, expect, it } from "vitest";
import {
	ACTIVE_LEAVE_REQUEST_STATUSES,
	calculateBusinessLeaveDays,
	calculateWorkingDaysInAdvance,
	getCompletedServiceYears,
	getDateRange,
	getLeaveCancellationTargetStatus,
	getLeaveCoverageForDate,
	getLeaveCycleBounds,
	isWeekendDate,
	OPERATIONALLY_ACTIVE_LEAVE_STATUSES,
} from "./leave-policy";

describe("leave-policy", () => {
	it("only allows pending or approved leave cancellation transitions", () => {
		expect(getLeaveCancellationTargetStatus("pending")).toBe("cancelled");
		expect(getLeaveCancellationTargetStatus("approved")).toBe(
			"pending_cancellation",
		);
		expect(getLeaveCancellationTargetStatus("revoked")).toBeNull();
	});

	it("treats cancellation-pending leave as active until approval", () => {
		expect(ACTIVE_LEAVE_REQUEST_STATUSES).toContain("pending_cancellation");
	});

	it("keeps cancellation-pending leave operational without activating pending requests", () => {
		expect(OPERATIONALLY_ACTIVE_LEAVE_STATUSES).toEqual([
			"approved",
			"pending_cancellation",
		]);
		expect(OPERATIONALLY_ACTIVE_LEAVE_STATUSES).not.toContain("pending");
	});

	it("resolves birthday-month leave cycles before and after the birthday month", () => {
		expect(
			getLeaveCycleBounds("1990-07-15", new Date("2026-06-11T00:00:00Z")),
		).toEqual({ cycleStart: "2025-07-01", cycleEnd: "2026-06-30" });

		expect(
			getLeaveCycleBounds("1990-07-15", new Date("2026-07-11T00:00:00Z")),
		).toEqual({ cycleStart: "2026-07-01", cycleEnd: "2027-06-30" });
	});

	it("uses the birthday month for leap-day birthdays", () => {
		expect(
			getLeaveCycleBounds("1992-02-29", new Date("2026-03-01T00:00:00Z")),
		).toEqual({ cycleStart: "2026-02-01", cycleEnd: "2027-01-31" });
	});

	it("builds inclusive date ranges and detects weekends", () => {
		expect(getDateRange("2026-06-11", "2026-06-13")).toEqual([
			"2026-06-11",
			"2026-06-12",
			"2026-06-13",
		]);
		expect(isWeekendDate("2026-06-13")).toBe(true);
		expect(isWeekendDate("2026-06-12")).toBe(false);
	});

	it("counts business leave days with weekends, holidays, and half days excluded", () => {
		expect(
			calculateBusinessLeaveDays({
				startDate: "2026-06-11",
				endDate: "2026-06-16",
				startDayPortion: "first_half",
				endDayPortion: "second_half",
				holidayDates: ["2026-06-15"],
			}),
		).toBe(2);
	});

	it("counts single-day half-day leave as half a day", () => {
		expect(
			calculateBusinessLeaveDays({
				startDate: "2026-06-11",
				endDate: "2026-06-11",
				startDayPortion: "first_half",
				endDayPortion: "full_day",
				holidayDates: [],
			}),
		).toBe(0.5);
	});

	it("calculates working-day advance notice between application and start", () => {
		// Mon 2026-06-15 applying for the following Mon 2026-06-22:
		// a full work-week ahead == 5 working days.
		expect(calculateWorkingDaysInAdvance("2026-06-22", "2026-06-15")).toBe(5);
		// Same day → no advance notice.
		expect(calculateWorkingDaysInAdvance("2026-06-15", "2026-06-15")).toBe(0);
		// Applying on Tue 2026-07-21: next Tue (2026-07-28) is 5 working days,
		// but the closer next Mon (2026-07-27) is only 4.
		expect(calculateWorkingDaysInAdvance("2026-07-28", "2026-07-21")).toBe(5);
		expect(calculateWorkingDaysInAdvance("2026-07-27", "2026-07-21")).toBe(4);
	});

	it("calculates completed service years at the leave-cycle start", () => {
		expect(getCompletedServiceYears("2023-07-01", "2026-07-01")).toBe(3);
		expect(getCompletedServiceYears("2023-07-02", "2026-07-01")).toBe(2);
		expect(getCompletedServiceYears(null, "2026-07-01")).toBe(0);
		expect(getCompletedServiceYears("2026-07-02", "2026-07-01")).toBe(0);
	});

	it("returns full or half-day coverage for a date in a leave range", () => {
		expect(
			getLeaveCoverageForDate({
				date: "2026-06-11",
				startDate: "2026-06-11",
				endDate: "2026-06-12",
				isHalfDayStart: true,
				halfDayStartPeriod: "second_half",
				isHalfDayEnd: false,
				halfDayEndPeriod: null,
			}),
		).toBe("second_half");

		expect(
			getLeaveCoverageForDate({
				date: "2026-06-12",
				startDate: "2026-06-11",
				endDate: "2026-06-12",
				isHalfDayStart: true,
				halfDayStartPeriod: "second_half",
				isHalfDayEnd: false,
				halfDayEndPeriod: null,
			}),
		).toBe("full_day");
	});
});
