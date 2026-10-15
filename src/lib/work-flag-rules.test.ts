import { describe, expect, it } from "vitest";
import {
	checkEstimateExceeded,
	checkNoTaskLinked,
	checkStalledTask,
} from "./work-flag-rules";

describe("checkNoTaskLinked", () => {
	it("returns null for draft updates even with 0 items", () => {
		const res = checkNoTaskLinked({ status: "draft", itemCount: 0 });
		expect(res).toBeNull();
	});

	it("returns null when a submitted update links at least 1 task", () => {
		const res = checkNoTaskLinked({ status: "submitted", itemCount: 1 });
		expect(res).toBeNull();
	});

	it("raises info flag when a submitted update links 0 tasks", () => {
		const res = checkNoTaskLinked({ status: "submitted", itemCount: 0 });
		expect(res).not.toBeNull();
		expect(res?.flagCode).toBe("no_task_linked");
		expect(res?.severity).toBe("info");
	});
});

describe("checkStalledTask", () => {
	it("returns null if task is not in_progress", () => {
		const res = checkStalledTask({
			status: "todo",
			today: "2026-08-29",
		});
		expect(res).toBeNull();
	});

	it("raises stalled flag if task has no recorded reference date", () => {
		const res = checkStalledTask({
			status: "in_progress",
			lastReferencedDate: null,
			today: "2026-08-29",
			thresholdDays: 3,
		});
		expect(res).not.toBeNull();
		expect(res?.flagCode).toBe("stalled");
		expect(res?.severity).toBe("warning");
	});

	it("returns null if task was updated recently within threshold", () => {
		const res = checkStalledTask({
			status: "in_progress",
			lastReferencedDate: "2026-08-28",
			today: "2026-08-29",
			thresholdDays: 3,
		});
		expect(res).toBeNull();
	});

	it("raises stalled flag if elapsed days exceed threshold", () => {
		const res = checkStalledTask({
			status: "in_progress",
			lastReferencedDate: "2026-08-20",
			today: "2026-08-29",
			thresholdDays: 3,
		});
		expect(res).not.toBeNull();
		expect(res?.flagCode).toBe("stalled");
		expect(res?.evidence?.daysSinceUpdate).toBe(9);
	});
});

describe("checkEstimateExceeded", () => {
	it("returns null when estimate or actual is missing or 0", () => {
		expect(
			checkEstimateExceeded({ estimateHours: null, actualHours: 5 }),
		).toBeNull();
		expect(
			checkEstimateExceeded({ estimateHours: 10, actualHours: null }),
		).toBeNull();
		expect(
			checkEstimateExceeded({ estimateHours: 0, actualHours: 5 }),
		).toBeNull();
	});

	it("returns null when actual hours is within estimate or reasonable margin", () => {
		const res = checkEstimateExceeded({
			estimateHours: 10,
			actualHours: 11,
			thresholdMultiplier: 1.25,
		});
		expect(res).toBeNull();
	});

	it("raises warning flag when actual hours exceeds 125% of estimate", () => {
		const res = checkEstimateExceeded({
			estimateHours: 10,
			actualHours: 15,
			thresholdMultiplier: 1.25,
		});
		expect(res).not.toBeNull();
		expect(res?.flagCode).toBe("estimate_exceeded");
		expect(res?.severity).toBe("warning");
		expect(res?.evidence?.percentOver).toBe(50);
	});
});
