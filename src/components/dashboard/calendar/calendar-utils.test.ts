import { describe, expect, it } from "vitest";
import { buildMonthGrid, relativeDayLabel, shiftMonth } from "./calendar-utils";

describe("calendar utils", () => {
	it("builds Monday-first weeks that cover the month", () => {
		const weeks = buildMonthGrid("2026-11");
		expect(weeks.every((w) => w.length === 7)).toBe(true);
		expect(weeks[0][0].date).toBe("2026-10-26"); // 1 November 2026 is a Sunday
		expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(30);
	});
	it("shifts months across year boundaries", () => {
		expect(shiftMonth("2026-12", 1)).toBe("2027-01");
		expect(shiftMonth("2027-01", -1)).toBe("2026-12");
	});
	it("labels days relative to today", () => {
		expect(relativeDayLabel("2026-10-16", "2026-10-16")).toBe("Today");
		expect(relativeDayLabel("2026-10-17", "2026-10-16")).toBe("Tomorrow");
		expect(relativeDayLabel("2026-10-24", "2026-10-20")).toBe("Sat, Oct 24");
	});
});
