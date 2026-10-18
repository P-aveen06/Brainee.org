import { describe, expect, it } from "vitest";
import { resolveRelativeDate } from "./relative-date";

describe("resolveRelativeDate", () => {
	it("resolves common relative dates", () => {
		expect(resolveRelativeDate("today", "2026-10-16")).toMatchObject({
			isoDate: "2026-10-16",
		});
		expect(resolveRelativeDate("tomorrow", "2026-10-16")).toMatchObject({
			isoDate: "2026-10-17",
		});
		expect(
			resolveRelativeDate("day after tomorrow", "2026-12-31"),
		).toMatchObject({ isoDate: "2027-01-02" });
	});

	it("resolves weekdays deterministically", () => {
		expect(resolveRelativeDate("monday", "2026-10-18")).toMatchObject({
			isoDate: "2026-10-19",
		});
		expect(resolveRelativeDate("next Monday", "2026-10-18")).toMatchObject({
			isoDate: "2026-10-26",
		});
	});

	it("resolves partial dates to the nearest non-past occurrence", () => {
		expect(resolveRelativeDate("Oct 16th", "2026-10-16")).toMatchObject({
			isoDate: "2026-10-16",
		});
		expect(resolveRelativeDate("16 October", "2026-10-17")).toMatchObject({
			isoDate: "2027-10-16",
		});
	});

	it("rejects invalid dates", () => {
		expect(resolveRelativeDate("2026-11-31", "2026-10-16").status).toBe(
			"invalid",
		);
		expect(resolveRelativeDate("sometime soon", "2026-10-16").status).toBe(
			"invalid",
		);
	});
});
