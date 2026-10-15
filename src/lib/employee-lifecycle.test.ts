import { describe, expect, it } from "vitest";
import {
	assessDeactivation,
	type DeactivationSnapshot,
	resolveAccessState,
} from "./employee-lifecycle";

const base: DeactivationSnapshot = {
	targetUserId: "target",
	targetRole: "user",
	targetIsActive: true,
	actorUserId: "admin-1",
	directReportIds: [],
	targetPeerLeadId: null,
	otherActiveAdminCount: 2,
	reassignReportsTo: null,
	reassignTargetIsActive: false,
};

const snapshot = (over: Partial<DeactivationSnapshot> = {}) => ({
	...base,
	...over,
});

describe("assessDeactivation", () => {
	it("allows deactivating an ordinary employee with no reports", () => {
		const result = assessDeactivation(snapshot());
		expect(result.canProceed).toBe(true);
		expect(result.blockers).toEqual([]);
		expect(result.reportsToReassign.userIds).toEqual([]);
	});

	it("refuses self-deactivation", () => {
		const result = assessDeactivation(
			snapshot({ targetUserId: "admin-1", targetRole: "admin" }),
		);
		expect(result.canProceed).toBe(false);
		expect(result.blockers.map((b) => b.code)).toContain("self_deactivation");
	});

	it("refuses to deactivate the last active admin", () => {
		const result = assessDeactivation(
			snapshot({ targetRole: "admin", otherActiveAdminCount: 0 }),
		);
		expect(result.canProceed).toBe(false);
		expect(result.blockers.map((b) => b.code)).toContain("last_admin");
	});

	it("allows deactivating an admin while another active admin remains", () => {
		const result = assessDeactivation(
			snapshot({ targetRole: "admin", otherActiveAdminCount: 1 }),
		);
		expect(result.canProceed).toBe(true);
	});

	it("blocks when the person still leads others and no new lead is given", () => {
		const result = assessDeactivation(
			snapshot({ targetRole: "lead", directReportIds: ["a", "b", "c"] }),
		);
		expect(result.canProceed).toBe(false);
		const blocker = result.blockers.find(
			(b) => b.code === "reports_need_reassignment",
		);
		expect(blocker).toBeDefined();
		expect(blocker).toMatchObject({ reportCount: 3 });
		expect(blocker?.message).toContain("3 employees");
	});

	it("singularises the message for exactly one report", () => {
		const result = assessDeactivation(
			snapshot({ targetRole: "lead", directReportIds: ["a"] }),
		);
		const blocker = result.blockers.find(
			(b) => b.code === "reports_need_reassignment",
		);
		expect(blocker?.message).toContain("1 employee.");
	});

	it("rejects reassigning reports to the departing person themselves", () => {
		const result = assessDeactivation(
			snapshot({
				targetRole: "lead",
				directReportIds: ["a"],
				reassignReportsTo: "target",
				reassignTargetIsActive: true,
			}),
		);
		expect(result.canProceed).toBe(false);
		expect(result.blockers.map((b) => b.code)).toContain(
			"invalid_reassign_target",
		);
	});

	it("rejects reassigning reports to an inactive employee", () => {
		const result = assessDeactivation(
			snapshot({
				targetRole: "lead",
				directReportIds: ["a"],
				reassignReportsTo: "someone-who-left",
				reassignTargetIsActive: false,
			}),
		);
		expect(result.canProceed).toBe(false);
		expect(result.blockers.map((b) => b.code)).toContain(
			"invalid_reassign_target",
		);
	});

	it("proceeds and reports the moves when a valid new lead is given", () => {
		const result = assessDeactivation(
			snapshot({
				targetRole: "lead",
				directReportIds: ["a", "b"],
				reassignReportsTo: "new-lead",
				reassignTargetIsActive: true,
			}),
		);
		expect(result.canProceed).toBe(true);
		expect(result.reportsToReassign).toEqual({
			userIds: ["a", "b"],
			newLeadId: "new-lead",
			successorId: null,
			successorNewLeadId: null,
		});
	});

	it("promotes a successor from within the team without self-leading them", () => {
		// A leads B and C. A departs and B is promoted: C moves to B, and B
		// moves up to A's own lead rather than becoming their own lead.
		const result = assessDeactivation(
			snapshot({
				targetRole: "lead",
				directReportIds: ["b", "c"],
				targetPeerLeadId: "grandparent",
				reassignReportsTo: "b",
				reassignTargetIsActive: true,
			}),
		);
		expect(result.canProceed).toBe(true);
		expect(result.reportsToReassign).toEqual({
			userIds: ["c"],
			newLeadId: "b",
			successorId: "b",
			successorNewLeadId: "grandparent",
		});
	});

	it("makes an internally promoted successor a root when the departing lead had none", () => {
		const result = assessDeactivation(
			snapshot({
				targetRole: "lead",
				directReportIds: ["b"],
				targetPeerLeadId: null,
				reassignReportsTo: "b",
				reassignTargetIsActive: true,
			}),
		);
		expect(result.canProceed).toBe(true);
		expect(result.reportsToReassign.userIds).toEqual([]);
		expect(result.reportsToReassign.successorId).toBe("b");
		expect(result.reportsToReassign.successorNewLeadId).toBeNull();
	});

	it("blocks deactivation when the person owns projects", () => {
		const result = assessDeactivation(
			snapshot({
				ownedProjectIds: ["prj-1", "prj-2"],
			}),
		);
		expect(result.canProceed).toBe(false);
		expect(result.blockers.map((b) => b.code)).toContain("owns_projects");
		const blocker = result.blockers.find((b) => b.code === "owns_projects");
		expect(blocker?.message).toContain("owns 2 projects");
	});

	it("accumulates independent blockers rather than stopping at the first", () => {
		const result = assessDeactivation(
			snapshot({
				targetUserId: "admin-1",
				targetRole: "admin",
				otherActiveAdminCount: 0,
				directReportIds: ["a"],
				ownedProjectIds: ["prj-1"],
			}),
		);
		expect(result.blockers.map((b) => b.code).sort()).toEqual([
			"last_admin",
			"owns_projects",
			"reports_need_reassignment",
			"self_deactivation",
		]);
	});
});

describe("resolveAccessState", () => {
	it("treats a missing user as anonymous", () => {
		expect(resolveAccessState(null)).toBe("anonymous");
		expect(resolveAccessState(undefined)).toBe("anonymous");
	});

	it("distinguishes an active user from a deactivated one", () => {
		expect(resolveAccessState({ isActive: true })).toBe("active");
		expect(resolveAccessState({ isActive: false })).toBe("deactivated");
	});
});
