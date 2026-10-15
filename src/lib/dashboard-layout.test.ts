import { describe, expect, it } from "vitest";
import {
	countGridRows,
	getDefaultLayout,
	packBentoGrid,
	resolveLayout,
	widgetSize,
} from "./dashboard-layout";

const ids = (l: { id: string }[]) => l.map((e) => e.id);

describe("resolveLayout", () => {
	it("falls back to the role default when nothing is saved", () => {
		expect(resolveLayout(null, "user")).toEqual(getDefaultLayout("user"));
		expect(resolveLayout("garbage", "lead")).toEqual(getDefaultLayout("lead"));
	});

	it("hides role-restricted widgets from other roles", () => {
		expect(ids(getDefaultLayout("user"))).not.toContain("approvals");
		expect(ids(getDefaultLayout("lead"))).toContain("approvals");
		expect(ids(getDefaultLayout("hr"))).not.toContain("approvals");
	});

	it("keeps saved order and hidden flags", () => {
		const out = resolveLayout(
			[
				{ id: "work", hidden: false },
				{ id: "hours", hidden: true },
			],
			"user",
		);
		expect(ids(out).slice(0, 2)).toEqual(["work", "hours"]);
		expect(out[1].hidden).toBe(true);
	});

	it("drops unknown, duplicate and disallowed ids, and appends new widgets", () => {
		const out = resolveLayout(
			[
				{ id: "nope", hidden: false },
				{ id: "approvals", hidden: false },
				{ id: "hours", hidden: false },
				{ id: "hours", hidden: true },
			],
			"user",
		);
		// Saved order wins; unsaved widgets follow in default order.
		expect(ids(out)).toEqual(["hours", "team", "leave", "work"]);
		expect(out[0].hidden).toBe(false);
	});

	it("shows all five cards to admins and leads", () => {
		expect(getDefaultLayout("admin").every((e) => !e.hidden)).toBe(true);
		expect(ids(getDefaultLayout("admin"))).toEqual([
			"team",
			"hours",
			"leave",
			"approvals",
			"work",
		]);
		expect(ids(getDefaultLayout("lead"))).toContain("approvals");
	});

	it("keeps the old updates/tasks slot when merging them into work", () => {
		const out = resolveLayout(
			[
				{ id: "hours", hidden: false },
				{ id: "tasks", hidden: false },
				{ id: "updates", hidden: false },
				{ id: "team", hidden: true },
			],
			"user",
		);
		expect(ids(out).slice(0, 3)).toEqual(["hours", "work", "team"]);
		expect(ids(out).filter((i) => i === "work")).toHaveLength(1);
		expect(ids(out)).not.toContain("tasks");
	});

	it("drops widgets removed from the app", () => {
		const out = resolveLayout(
			[
				{ id: "activity", hidden: false },
				{ id: "myday", hidden: false },
				{ id: "work", hidden: false },
			],
			"user",
		);
		expect(ids(out)[0]).toBe("work");
		expect(ids(out)).not.toContain("activity");
		expect(ids(out)).not.toContain("myday");
	});

	it("treats an unknown role as a regular user", () => {
		expect(ids(getDefaultLayout("contractor"))).toEqual(
			ids(getDefaultLayout("user")),
		);
	});
});

describe("grid sizing", () => {
	it("gives My work the full row when approvals is not shown", () => {
		expect(widgetSize("work", ["team", "work"])).toBe("lg");
		expect(widgetSize("work", ["approvals", "work"])).toBe("md");
		expect(widgetSize("hours", ["hours"])).toBe("sm");
	});
	it("counts rows like CSS auto-placement on 6 columns", () => {
		expect(countGridRows([])).toBe(0);
		expect(countGridRows(["sm", "sm", "sm"])).toBe(1);
		expect(countGridRows(["sm", "sm", "sm", "md", "md"])).toBe(2);
		expect(countGridRows(["sm", "sm", "sm", "lg"])).toBe(2);
		expect(countGridRows(["sm", "md"])).toBe(1);
	});
});

describe("packBentoGrid", () => {
	it("packs standard admin layout with zero empty spaces (3 small, 2 medium)", () => {
		const layout = getDefaultLayout("admin");
		const packed = packBentoGrid(layout);
		expect(packed).toHaveLength(5);
		// Row 1: team, hours, leave (all span 2, sum = 6)
		expect(packed.slice(0, 3).map((p) => p.span)).toEqual([2, 2, 2]);
		expect(packed.slice(0, 3).map((p) => p.size)).toEqual(["sm", "sm", "sm"]);
		// Row 2: approvals, work (both span 3, sum = 6)
		expect(packed.slice(3, 5).map((p) => p.span)).toEqual([3, 3]);
		expect(packed.slice(3, 5).map((p) => p.size)).toEqual(["md", "md"]);
	});

	it("stretches a single card to full row (lg / span 6)", () => {
		const packed = packBentoGrid([{ id: "work", hidden: false }]);
		expect(packed).toHaveLength(1);
		expect(packed[0].span).toBe(6);
		expect(packed[0].size).toBe("lg");
		expect(packed[0].colClass).toBe("md:col-span-6");
	});

	it("fits two small cards into a 6-column row as medium cards (3 + 3 = 6)", () => {
		const packed = packBentoGrid([
			{ id: "hours", hidden: false, size: "sm" },
			{ id: "leave", hidden: false, size: "sm" },
		]);
		expect(packed).toHaveLength(2);
		expect(packed.map((p) => p.span)).toEqual([3, 3]);
		expect(packed.map((p) => p.size)).toEqual(["md", "md"]);
	});

	it("supports custom large variants and guarantees all rows sum to 6", () => {
		const packed = packBentoGrid([
			{ id: "work", hidden: false, size: "lg" },
			{ id: "hours", hidden: false, size: "sm" },
			{ id: "leave", hidden: false, size: "sm" },
			{ id: "team", hidden: false, size: "sm" },
			{ id: "approvals", hidden: false, size: "lg" },
		]);
		expect(packed).toHaveLength(5);
		expect(packed[0].span).toBe(6); // Row 1
		expect(packed.slice(1, 4).map((p) => p.span)).toEqual([2, 2, 2]); // Row 2
		expect(packed[4].span).toBe(6); // Row 3
		const totalSpan = packed.reduce((sum, p) => sum + p.span, 0);
		expect(totalSpan % 6).toBe(0);
	});
});
