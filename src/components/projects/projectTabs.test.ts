import { describe, expect, it } from "vitest";
import { TABS } from "./ProjectHeaderSection";

describe("ProjectHeaderSection TABS configuration", () => {
	it("has exactly 5 consolidated tabs", () => {
		expect(TABS).toHaveLength(5);
	});

	it("defaults to overview as the first tab", () => {
		expect(TABS[0].value).toBe("overview");
		expect(TABS[0].label).toBe("Overview");
	});

	it("maintains the expected tab sequence", () => {
		const tabValues = TABS.map((t) => t.value);
		expect(tabValues).toEqual([
			"overview",
			"tasks",
			"daily",
			"checklists",
			"documents",
		]);
	});

	it("completely omits discussions", () => {
		const tabValues = TABS.map((t) => t.value);
		expect(tabValues).not.toContain("discussions");
	});

	it("correctly partitions active and past members", () => {
		const sampleMembers = [
			{ id: "1", isCurrent: true, isActive: true },
			{ id: "2", isCurrent: false, isActive: true },
			{ id: "3", isCurrent: true, isActive: false },
			{ id: "4", isCurrent: true },
		];

		const active = sampleMembers.filter(
			(m) => m.isCurrent !== false && m.isActive !== false,
		);
		const past = sampleMembers.filter(
			(m) => m.isCurrent === false || m.isActive === false,
		);

		expect(active.map((m) => m.id)).toEqual(["1", "4"]);
		expect(past.map((m) => m.id)).toEqual(["2", "3"]);
	});
});
