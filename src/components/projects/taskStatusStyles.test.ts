import { describe, expect, it } from "vitest";
import {
	TASK_PRIORITY_CONFIG,
	TASK_STATUS_CONFIG,
	type TaskPriorityKey,
	type TaskStatusKey,
} from "./taskStatusStyles";

describe("taskStatusStyles", () => {
	it("defines valid configuration for all standard task statuses", () => {
		const expectedStatuses: TaskStatusKey[] = [
			"todo",
			"in_progress",
			"blocked",
			"in_review",
			"done",
			"cancelled",
		];

		for (const status of expectedStatuses) {
			const config = TASK_STATUS_CONFIG[status];
			expect(config).toBeDefined();
			expect(config.label).toBeTruthy();
			expect(config.badge).toBeTruthy();
			expect(config.dot).toBeTruthy();
			expect(config.icon).toBeDefined();
		}
	});

	it("defines valid configuration for all priority tiers", () => {
		const expectedPriorities: TaskPriorityKey[] = [
			"low",
			"medium",
			"high",
			"critical",
		];

		for (const priority of expectedPriorities) {
			const config = TASK_PRIORITY_CONFIG[priority];
			expect(config).toBeDefined();
			expect(config.label).toBeTruthy();
			expect(config.badge).toBeTruthy();
			expect(config.icon).toBeDefined();
		}
	});
});
