import { describe, expect, it } from "vitest";
import { buildHeatmapWeeks, computeStreak } from "./hours-heatmap";

const input = (
	hours: Record<string, number>,
	off: string[] = [],
	today = "2026-11-06",
) => ({
	today,
	hoursByDate: new Map(Object.entries(hours)),
	offDates: new Set(off),
	standardHours: 8,
});

describe("buildHeatmapWeeks", () => {
	it("lays Mon-Fri out per week and classifies each day", () => {
		const weeks = buildHeatmapWeeks(
			"2026-11",
			input({ "2026-11-02": 8, "2026-11-03": 4, "2026-11-04": 9 }, [
				"2026-11-05",
			]),
		);
		const cells = weeks.flat().filter(Boolean);
		expect(cells).toHaveLength(21); // working days in November 2026
		expect(weeks[0][0]?.date).toBe("2026-11-02");
		const state = (d: string) => cells.find((c) => c?.date === d)?.state;
		expect(state("2026-11-02")).toBe("full");
		expect(state("2026-11-03")).toBe("partial");
		expect(state("2026-11-04")).toBe("over");
		expect(state("2026-11-05")).toBe("off");
		expect(state("2026-11-06")).toBe("today");
		expect(state("2026-11-09")).toBe("future");
	});
	it("marks past working days with no hours as missed", () => {
		const cells = buildHeatmapWeeks("2026-11", input({}, [], "2026-11-03"))
			.flat()
			.filter(Boolean);
		expect(cells.find((c) => c?.date === "2026-11-02")?.state).toBe("missed");
	});
});

describe("computeStreak", () => {
	it("counts consecutive working days, skipping weekends", () => {
		// Fri 16, Mon 19, Tue 20 and Wed 21 logged; Thu 22 (today) not yet.
		const s = computeStreak(
			input({
				"2026-10-16": 8,
				"2026-10-19": 8,
				"2026-10-20": 8,
				"2026-10-21": 8,
			}, [], "2026-10-22"),
		);
		expect(s).toBe(4);
	});
	it("adds today once it is logged", () => {
		expect(
			computeStreak(
				input({ "2026-10-16": 8, "2026-10-19": 8 }, [], "2026-10-19"),
			),
		).toBe(2);
	});
	it("does not break on holidays or leave", () => {
		expect(
			computeStreak(
				input(
					{ "2026-10-16": 8, "2026-10-20": 8 },
					["2026-10-19"],
					"2026-10-20",
				),
			),
		).toBe(2);
	});
	it("breaks at a missed working day", () => {
		expect(
			computeStreak(
				input({ "2026-10-16": 8, "2026-10-20": 8 }, [], "2026-10-20"),
			),
		).toBe(1);
	});
});
