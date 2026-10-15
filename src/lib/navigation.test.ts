import { describe, expect, it } from "vitest";
import {
	getActiveHref,
	getNavigationGroups,
	getNavigationLinks,
} from "./navigation";

describe("navigation - getActiveHref", () => {
	const mockItems = [
		{ href: "/" },
		{ href: "/projects" },
		{ href: "/my-tasks" },
		{ href: "/calendar" },
		{ href: "/organization" },
		{ href: "/admin" },
		{ href: "/admin/assets" },
		{ href: "/admin/stats" },
		{ href: "/admin/projects" },
	];

	it("matches root path only when exact", () => {
		expect(getActiveHref("/", mockItems)).toBe("/");
		expect(getActiveHref("/unknown", mockItems)).toBeNull();
	});

	it("matches exact href", () => {
		expect(getActiveHref("/projects", mockItems)).toBe("/projects");
		expect(getActiveHref("/admin", mockItems)).toBe("/admin");
	});

	it("matches nested routes using longest prefix", () => {
		// Deep admin route matches /admin
		expect(getActiveHref("/admin/employees/123", mockItems)).toBe("/admin");
		expect(getActiveHref("/admin/employees/123/edit", mockItems)).toBe(
			"/admin",
		);

		// Asset nested route matches /admin/assets (longest prefix) instead of /admin
		expect(getActiveHref("/admin/assets/item-456", mockItems)).toBe(
			"/admin/assets",
		);

		// Project nested route matches /projects
		expect(getActiveHref("/projects/proj-123/tasks", mockItems)).toBe(
			"/projects",
		);
	});

	it("returns null for null, undefined, or empty pathnames", () => {
		expect(getActiveHref(null, mockItems)).toBeNull();
		expect(getActiveHref(undefined, mockItems)).toBeNull();
		expect(getActiveHref("", mockItems)).toBeNull();
	});
});

describe("navigation - role-based filtering", () => {
	it("allows hr role to access standard workplace and employee destinations", () => {
		const hrLinks = getNavigationLinks("hr");
		const hrHrefs = hrLinks.map((item) => item.href);

		expect(hrHrefs).toContain("/");
		expect(hrHrefs).toContain("/assistant");
		expect(hrHrefs).toContain("/projects");
		expect(hrHrefs).toContain("/my-tasks");
		expect(hrHrefs).toContain("/calendar");
		expect(hrHrefs).toContain("/team-calendar");
		expect(hrHrefs).toContain("/organization");

		// HR does NOT see admin-only destinations
		expect(hrHrefs).not.toContain("/admin");
		expect(hrHrefs).not.toContain("/admin/assets");
		expect(hrHrefs).not.toContain("/admin/stats");
		expect(hrHrefs).not.toContain("/admin/projects");
		expect(hrHrefs).not.toContain("/approvals");
	});

	it("filters out empty navigation groups for roles", () => {
		const userGroups = getNavigationGroups("user");
		const userGroupIds = userGroups.map((g) => g.id);

		expect(userGroupIds).toContain("workspace");
		expect(userGroupIds).toContain("projects");
		expect(userGroupIds).toContain("people");
		expect(userGroupIds).not.toContain("admin");
	});

	it("allows admin to access all destinations including Project Settings", () => {
		const adminLinks = getNavigationLinks("admin");
		const adminHrefs = adminLinks.map((item) => item.href);

		expect(adminHrefs).toContain("/admin/projects");
		expect(adminHrefs).toContain("/admin/assets");
		expect(adminHrefs).toContain("/admin/stats");
		expect(adminHrefs).toContain("/admin");
		expect(adminHrefs).toContain("/approvals");
	});

	it("ensures no duplicate icons within the same visible group", () => {
		const adminGroups = getNavigationGroups("admin");
		for (const group of adminGroups) {
			const icons = group.items.map((i) => i.icon);
			const uniqueIcons = new Set(icons);
			expect(uniqueIcons.size).toBe(icons.length);
		}
	});
});
