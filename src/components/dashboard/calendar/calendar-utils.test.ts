import { describe, expect, it } from "vitest";
import { buildMonthGrid, relativeDayLabel, shiftMonth } from "./calendar-utils";

describe("calendar utils", () => {
	it("builds Monday-first weeks that cover the month", () => {
		const weeks = buildMonthGrid("2026-10");
		expect(weeks.every((w) => w.length === 7)).toBe(true);
		expect(weeks[0][0].date).toBe("2026-09-28"); // 1 Oct 2026 is a Thursday
		expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(31);
	});
	it("shifts months across year boundaries", () => {
		expect(shiftMonth("2026-12", 1)).toBe("2027-01");
		expect(shiftMonth("2026-01", -1)).toBe("2025-12");
	});
	it("labels days relative to today", () => {
		expect(relativeDayLabel("2026-10-07", "2026-10-07")).toBe("Today");
		expect(relativeDayLabel("2026-10-08", "2026-10-07")).toBe("Tomorrow");
		expect(relativeDayLabel("2026-10-10", "2026-10-07")).toBe("Sat, Oct 10");
	});
});
