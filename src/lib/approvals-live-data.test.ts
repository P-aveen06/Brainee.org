import { describe, expect, it } from "vitest";
import { isActionableApprovalStatus } from "./approvals-live-data.server";

describe("isActionableApprovalStatus", () => {
	it.each([
		"pending",
		"pending_cancellation",
	])("treats %s as actionable", (status) => {
		expect(isActionableApprovalStatus(status)).toBe(true);
	});

	it.each([
		"approved",
		"rejected",
		"cancelled",
		"revoked",
	])("does not count %s as actionable", (status) => {
		expect(isActionableApprovalStatus(status)).toBe(false);
	});
});
