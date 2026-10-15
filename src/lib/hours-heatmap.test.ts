import { describe, expect, it } from "vitest";
import { buildHeatmapWeeks, computeStreak } from "./hours-heatmap";

const input = (
	hours: Record<string, number>,
	off: string[] = [],
	today = "2026-10-07",
) => ({
	today,
	hoursByDate: new Map(Object.entries(hours)),
	offDates: new Set(off),
	standardHours: 8,
});

describe("buildHeatmapWeeks", () => {
	it("lays Mon-Fri out per week and classifies each day", () => {
		const weeks = buildHeatmapWeeks(
			"2026-10",
			input({ "2026-10-01": 8, "2026-10-02": 4, "2026-10-05": 9 }, [
				"2026-10-06",
			]),
		);
		const cells = weeks.flat().filter(Boolean);
		expect(cells).toHaveLength(22); // working days in Oct 2026
		expect(weeks[0].slice(0, 3)).toEqual([null, null, null]); // 1 Oct is a Thursday
		const state = (d: string) => cells.find((c) => c?.date === d)?.state;
		expect(state("2026-10-01")).toBe("full");
		expect(state("2026-10-02")).toBe("partial");
		expect(state("2026-10-05")).toBe("over");
		expect(state("2026-10-06")).toBe("off");
		expect(state("2026-10-07")).toBe("today");
		expect(state("2026-10-08")).toBe("future");
	});
	it("marks past working days with no hours as missed", () => {
		const cells = buildHeatmapWeeks("2026-10", input({}))
			.flat()
			.filter(Boolean);
		expect(cells.find((c) => c?.date === "2026-10-01")?.state).toBe("missed");
	});
});

describe("computeStreak", () => {
	it("counts consecutive working days, skipping weekends", () => {
		// Thu 1, Fri 2, Mon 5, Tue 6 logged; Wed 7 (today) not yet.
		const s = computeStreak(
			input({
				"2026-10-01": 8,
				"2026-10-02": 8,
				"2026-10-05": 8,
				"2026-10-06": 8,
			}),
		);
		expect(s).toBe(4);
	});
	it("adds today once it is logged", () => {
		expect(computeStreak(input({ "2026-10-06": 8, "2026-10-07": 8 }))).toBe(2);
	});
	it("does not break on holidays or leave", () => {
		expect(
			computeStreak(
				input({ "2026-10-02": 8, "2026-10-06": 8 }, ["2026-10-05"]),
			),
		).toBe(2);
	});
	it("breaks at a missed working day", () => {
		expect(computeStreak(input({ "2026-10-02": 8, "2026-10-06": 8 }))).toBe(1);
	});
});
