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
			getLeaveCycleBounds("2028-07-15", new Date("2028-06-11T00:00:00Z")),
		).toEqual({ cycleStart: "2027-07-01", cycleEnd: "2028-06-30" });

		expect(
			getLeaveCycleBounds("2028-07-15", new Date("2028-07-11T00:00:00Z")),
		).toEqual({ cycleStart: "2028-07-01", cycleEnd: "2029-06-30" });
	});

	it("uses the birthday month for leap-day birthdays", () => {
		expect(
			getLeaveCycleBounds("2028-02-29", new Date("2027-10-16T00:00:00Z")),
		).toEqual({ cycleStart: "2027-02-01", cycleEnd: "2028-01-31" });
	});

	it("builds inclusive date ranges and detects weekends", () => {
		expect(getDateRange("2026-10-16", "2026-10-18")).toEqual([
			"2026-10-16",
			"2026-10-17",
			"2026-10-18",
		]);
		expect(isWeekendDate("2026-10-17")).toBe(true);
		expect(isWeekendDate("2026-10-16")).toBe(false);
	});

	it("counts business leave days with weekends, holidays, and half days excluded", () => {
		expect(
			calculateBusinessLeaveDays({
				startDate: "2026-10-16",
				endDate: "2026-10-21",
				startDayPortion: "first_half",
				endDayPortion: "second_half",
				holidayDates: ["2026-10-19"],
			}),
		).toBe(2);
	});

	it("counts single-day half-day leave as half a day", () => {
		expect(
			calculateBusinessLeaveDays({
				startDate: "2026-10-16",
				endDate: "2026-10-16",
				startDayPortion: "first_half",
				endDayPortion: "full_day",
				holidayDates: [],
			}),
		).toBe(0.5);
	});

	it("calculates working-day advance notice between application and start", () => {
		// Mon 2026-10-19 applying for the following Mon 2026-10-26:
		// a full work-week ahead == 5 working days.
		expect(calculateWorkingDaysInAdvance("2026-10-26", "2026-10-19")).toBe(5);
		// Same day → no advance notice.
		expect(calculateWorkingDaysInAdvance("2026-10-19", "2026-10-19")).toBe(0);
		// Applying on Tue 2026-10-20: the following Tue (2026-10-27) is 5 workdays,
		// while the closer Mon (2026-10-26) is only 4.
		expect(calculateWorkingDaysInAdvance("2026-10-27", "2026-10-20")).toBe(5);
		expect(calculateWorkingDaysInAdvance("2026-10-26", "2026-10-20")).toBe(4);
	});

	it("calculates completed service years at the leave-cycle start", () => {
		expect(getCompletedServiceYears("2026-10-16", "2029-10-16")).toBe(3);
		expect(getCompletedServiceYears("2026-10-17", "2029-10-16")).toBe(2);
		expect(getCompletedServiceYears(null, "2029-10-16")).toBe(0);
		expect(getCompletedServiceYears("2029-10-17", "2029-10-16")).toBe(0);
	});

	it("returns full or half-day coverage for a date in a leave range", () => {
		expect(
			getLeaveCoverageForDate({
				date: "2026-10-16",
				startDate: "2026-10-16",
				endDate: "2026-10-19",
				isHalfDayStart: true,
				halfDayStartPeriod: "second_half",
				isHalfDayEnd: false,
				halfDayEndPeriod: null,
			}),
		).toBe("second_half");

		expect(
			getLeaveCoverageForDate({
				date: "2026-10-19",
				startDate: "2026-10-16",
				endDate: "2026-10-19",
				isHalfDayStart: true,
				halfDayStartPeriod: "second_half",
				isHalfDayEnd: false,
				halfDayEndPeriod: null,
			}),
		).toBe("full_day");
	});
});
