import { describe, expect, it } from "vitest";
import {
	meetsAccessLevel,
	type ProjectRole,
	resolveProjectAccess,
} from "./project-access";

describe("resolveProjectAccess", () => {
	const project = { id: "prj-1", ownerId: "user-owner" };

	describe("Global Admin", () => {
		it("grants full owner access to admin regardless of project owner or membership", () => {
			const user = { id: "user-admin", role: "admin" as const };
			const access = resolveProjectAccess(user, project, null);

			expect(access).not.toBeNull();
			expect(access?.role).toBe("owner");
			expect(access?.canView).toBe(true);
			expect(access?.canContribute).toBe(true);
			expect(access?.canManage).toBe(true);
			expect(access?.canOwn).toBe(true);
		});
	});

	describe("Project Owner", () => {
		it("grants full owner access to the project owner matching projects.ownerId", () => {
			const user = { id: "user-owner", role: "user" as const };
			const access = resolveProjectAccess(user, project, null);

			expect(access).not.toBeNull();
			expect(access?.role).toBe("owner");
			expect(access?.canView).toBe(true);
			expect(access?.canContribute).toBe(true);
			expect(access?.canManage).toBe(true);
			expect(access?.canOwn).toBe(true);
		});
	});

	describe("Active Member Roles", () => {
		const regularUser = { id: "user-member", role: "user" as const };

		it("grants manager permissions (can manage, cannot own)", () => {
			const memberRow = { role: "manager" as ProjectRole, isCurrent: true };
			const access = resolveProjectAccess(regularUser, project, memberRow);

			expect(access).toEqual({
				role: "manager",
				canView: true,
				canContribute: true,
				canManage: true,
				canOwn: false,
			});
		});

		it("grants contributor permissions (can contribute, cannot manage or own)", () => {
			const memberRow = { role: "contributor" as ProjectRole, isCurrent: true };
			const access = resolveProjectAccess(regularUser, project, memberRow);

			expect(access).toEqual({
				role: "contributor",
				canView: true,
				canContribute: true,
				canManage: false,
				canOwn: false,
			});
		});

		it("grants viewer permissions (can view only)", () => {
			const memberRow = { role: "viewer" as ProjectRole, isCurrent: true };
			const access = resolveProjectAccess(regularUser, project, memberRow);

			expect(access).toEqual({
				role: "viewer",
				canView: true,
				canContribute: false,
				canManage: false,
				canOwn: false,
			});
		});
	});

	describe("Non-members and Departed Members", () => {
		it("returns null for non-members (null memberRow)", () => {
			const stranger = { id: "user-stranger", role: "user" as const };
			const access = resolveProjectAccess(stranger, project, null);
			expect(access).toBeNull();
		});

		it("returns null for lead without explicit membership (org chart grants nothing)", () => {
			const lead = { id: "user-lead", role: "lead" as const };
			const access = resolveProjectAccess(lead, project, null);
			expect(access).toBeNull();
		});

		it("returns null for past members whose isCurrent is false", () => {
			const pastMember = { id: "user-past", role: "user" as const };
			const memberRow = { role: "manager" as ProjectRole, isCurrent: false };
			const access = resolveProjectAccess(pastMember, project, memberRow);
			expect(access).toBeNull();
		});
	});
});

describe("meetsAccessLevel", () => {
	it("checks hierarchy correctly", () => {
		// Owner meets everything
		expect(meetsAccessLevel("owner", "owner")).toBe(true);
		expect(meetsAccessLevel("owner", "manager")).toBe(true);
		expect(meetsAccessLevel("owner", "contributor")).toBe(true);
		expect(meetsAccessLevel("owner", "viewer")).toBe(true);

		// Manager meets manager and below, but not owner
		expect(meetsAccessLevel("manager", "owner")).toBe(false);
		expect(meetsAccessLevel("manager", "manager")).toBe(true);
		expect(meetsAccessLevel("manager", "contributor")).toBe(true);
		expect(meetsAccessLevel("manager", "viewer")).toBe(true);

		// Contributor meets contributor and viewer
		expect(meetsAccessLevel("contributor", "owner")).toBe(false);
		expect(meetsAccessLevel("contributor", "manager")).toBe(false);
		expect(meetsAccessLevel("contributor", "contributor")).toBe(true);
		expect(meetsAccessLevel("contributor", "viewer")).toBe(true);

		// Viewer only meets viewer
		expect(meetsAccessLevel("viewer", "owner")).toBe(false);
		expect(meetsAccessLevel("viewer", "manager")).toBe(false);
		expect(meetsAccessLevel("viewer", "contributor")).toBe(false);
		expect(meetsAccessLevel("viewer", "viewer")).toBe(true);
	});
});
