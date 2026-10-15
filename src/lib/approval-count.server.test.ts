import { describe, expect, it } from "vitest";
import {
	ACTIONABLE_LEAVE_APPROVAL_STATUSES,
	ACTIONABLE_WFH_APPROVAL_STATUSES,
	resolveApprovalCountScope,
} from "./approval-count.server";

describe("approval badge count scope", () => {
	it("lets admins count all onboarded employees", () => {
		expect(resolveApprovalCountScope({ id: "admin-1", role: "admin" })).toEqual(
			{
				kind: "all",
			},
		);
	});

	it("limits leads to their onboarded direct reports", () => {
		expect(resolveApprovalCountScope({ id: "lead-1", role: "lead" })).toEqual({
			kind: "direct-reports",
			leadId: "lead-1",
		});
	});

	it("does not expose approval counts to regular users", () => {
		expect(
			resolveApprovalCountScope({ id: "user-1", role: "user" }),
		).toBeNull();
	});

	it("counts cancellation approval as actionable leave and wfh work", () => {
		expect(ACTIONABLE_LEAVE_APPROVAL_STATUSES).toEqual([
			"pending",
			"pending_cancellation",
		]);
		expect(ACTIONABLE_WFH_APPROVAL_STATUSES).toEqual([
			"pending",
			"pending_cancellation",
		]);
	});
});
