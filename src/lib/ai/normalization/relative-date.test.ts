import { describe, expect, it } from "vitest";
import { resolveRelativeDate } from "./relative-date";

describe("resolveRelativeDate", () => {
	it("resolves common relative dates", () => {
		expect(resolveRelativeDate("today", "2026-08-30")).toMatchObject({
			isoDate: "2026-08-30",
		});
		expect(resolveRelativeDate("tomorrow", "2026-08-30")).toMatchObject({
			isoDate: "2026-08-31",
		});
		expect(
			resolveRelativeDate("day after tomorrow", "2026-12-31"),
		).toMatchObject({ isoDate: "2027-01-02" });
	});

	it("resolves weekdays deterministically", () => {
		expect(resolveRelativeDate("monday", "2026-08-30")).toMatchObject({
			isoDate: "2026-08-31",
		});
		expect(resolveRelativeDate("next Monday", "2026-08-30")).toMatchObject({
			isoDate: "2026-09-07",
		});
	});

	it("resolves partial dates to the nearest non-past occurrence", () => {
		expect(resolveRelativeDate("Sep 3rd", "2026-08-30")).toMatchObject({
			isoDate: "2026-09-03",
		});
		expect(resolveRelativeDate("3 September", "2026-10-01")).toMatchObject({
			isoDate: "2027-09-03",
		});
	});

	it("rejects invalid dates", () => {
		expect(resolveRelativeDate("2026-02-30", "2026-08-30").status).toBe(
			"invalid",
		);
		expect(resolveRelativeDate("sometime soon", "2026-08-30").status).toBe(
			"invalid",
		);
	});
});
