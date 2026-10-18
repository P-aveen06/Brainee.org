import { describe, expect, it } from "vitest";
import {
	calculateWfhQuota,
	getExistingWfhDateError,
	getWfhCycleBounds,
	getWfhRequestDays,
	isCurrentWfhQuotaRequest,
	isWfhDateUniqueConstraintError,
	isValidWfhAllowance,
	isValidWfhDate,
} from "./wfh-policy";

describe("wfh-policy", () => {
	it("counts full and half-day WFH requests", () => {
		expect(getWfhRequestDays("full_day")).toBe(1);
		expect(getWfhRequestDays("first_half")).toBe(0.5);
		expect(getWfhRequestDays("second_half")).toBe(0.5);
	});

	it("uses the selected date to resolve the birthday-month quota cycle", () => {
		expect(getWfhCycleBounds("2028-07-15", "2028-06-30")).toEqual({
			cycleStart: "2027-07-01",
			cycleEnd: "2028-06-30",
		});
		expect(getWfhCycleBounds("2028-07-15", "2028-07-01")).toEqual({
			cycleStart: "2028-07-01",
			cycleEnd: "2029-06-30",
		});
	});

	it("accepts allowance values from 0.5 to 365 in half-day increments", () => {
		expect(isValidWfhAllowance(0.5)).toBe(true);
		expect(isValidWfhAllowance(12)).toBe(true);
		expect(isValidWfhAllowance(365)).toBe(true);
		expect(isValidWfhAllowance(0)).toBe(false);
		expect(isValidWfhAllowance(12.25)).toBe(false);
		expect(isValidWfhAllowance(365.5)).toBe(false);
	});

	it("accepts only real ISO calendar dates", () => {
		expect(isValidWfhDate("2026-10-16")).toBe(true);
		expect(isValidWfhDate("2026-11-31")).toBe(false);
		expect(isValidWfhDate("2026-11-6")).toBe(false);
		expect(isValidWfhDate("not-a-date")).toBe(false);
	});

	it("treats every existing same-date WFH row as a duplicate", () => {
		expect(getExistingWfhDateError(undefined)).toBeNull();
		expect(getExistingWfhDateError("pending")).toContain("already exists");
		expect(getExistingWfhDateError("rejected")).toContain("already exists");
		expect(getExistingWfhDateError("cancelled")).toContain("already exists");
	});

	it("recognizes only the WFH date unique-constraint failure", () => {
		expect(
			isWfhDateUniqueConstraintError(
				new Error("Unique constraint violation on WfhRequest.userId,date"),
			),
		).toBe(true);
		expect(
			isWfhDateUniqueConstraintError(
				new Error("CHECK constraint failed: wfh_policy_allowance_check"),
			),
		).toBe(false);
	});

	it("ignores quota responses from an older date request", () => {
		expect(isCurrentWfhQuotaRequest(2, 2)).toBe(true);
		expect(isCurrentWfhQuotaRequest(1, 2)).toBe(false);
	});

	it("reserves pending and approved WFH days against the allowance", () => {
		expect(
			calculateWfhQuota({ allowance: 12, reserved: 11.5, requested: 0.5 }),
		).toEqual({ used: 11.5, remaining: 0.5, canRequest: true });
		expect(
			calculateWfhQuota({ allowance: 12, reserved: 11.5, requested: 1 }),
		).toEqual({ used: 11.5, remaining: 0.5, canRequest: false });
	});
});
