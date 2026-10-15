import { describe, expect, it } from "vitest";
import {
	extractTasksWithAi,
	extractTaskWithAi,
} from "./ai-task-generator.server";

describe("AI Task Generator", () => {
	it("extracts task title and status from completed work summary", async () => {
		const summary =
			"Completed camera calibration pipeline and verified real-time stream decoding.";
		const result = await extractTaskWithAi(summary);

		expect(result.title).toBeTruthy();
		expect(result.title.length).toBeLessThanOrEqual(80);
		expect(["done", "in_progress"]).toContain(result.status);
	});

	it("identifies blocked status when blockers are supplied", async () => {
		const summary = "Working on camera calibration pipeline";
		const blockers = "Waiting for RTSP credentials from client POC";
		const result = await extractTaskWithAi(summary, blockers);

		expect(result.title).toBeTruthy();
		expect(result.status).toBe("blocked");
	});

	it("identifies in_progress status when work is ongoing", async () => {
		const summary = "Investigating memory leak in stream decoding worker";
		const result = await extractTaskWithAi(summary);

		expect(result.title).toBeTruthy();
		expect(["in_progress", "done"]).toContain(result.status);
	});

	it("splits multiple distinct work items into separate tasks instead of combining them", async () => {
		const summary =
			"worked in loggin page and fixed the bugs in home page, and testerd the download feature.";
		const tasks = await extractTasksWithAi(summary);

		expect(tasks.length).toBeGreaterThanOrEqual(2);
		for (const t of tasks) {
			expect(t.title).toBeTruthy();
			expect(t.status).toBeDefined();
		}
	});
});
