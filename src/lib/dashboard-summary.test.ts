import { describe, expect, it } from "vitest";
import { buildHeroSummary, countWorkdays } from "./dashboard-summary";

describe("countWorkdays", () => {
	it("counts Mon-Fri in a month (Oct 2026 has 22)", () => {
		expect(countWorkdays(2026, 9)).toBe(22);
	});
	it("stops at the given day", () => {
		expect(countWorkdays(2026, 9, 7)).toBe(5); // Thu 1 to Wed 7
	});
});

describe("buildHeroSummary", () => {
	const base = {
		pendingApprovals: 0,
		hasLoggedToday: true,
		outToday: [],
		overdueTasks: 0,
		dueTodayTasks: 0,
	};
	it("says all caught up when nothing needs attention", () => {
		expect(buildHeroSummary(base)).toMatch(/all caught up/i);
	});
	it("joins the items that matter", () => {
		expect(
			buildHeroSummary({
				...base,
				pendingApprovals: 2,
				hasLoggedToday: false,
				outToday: ["Priya Sharma"],
			}),
		).toBe("2 approvals waiting, you haven't logged today, Priya is out.");
	});
	it("prefers overdue over due-today", () => {
		expect(
			buildHeroSummary({ ...base, overdueTasks: 1, dueTodayTasks: 3 }),
		).toBe("1 task overdue.");
	});
});
