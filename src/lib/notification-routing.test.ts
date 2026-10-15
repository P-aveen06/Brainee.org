import { describe, expect, it } from "vitest";
import { buildNotificationRecord } from "./notification-routing";

describe("buildNotificationRecord", () => {
	it("persists an action URL for actionable notifications", () => {
		const record = buildNotificationRecord({
			userId: "user-1",
			type: "leave_requested",
			title: "Leave request",
			body: "A request needs review.",
			actionUrl: "/approvals",
		});

		expect(record.actionUrl).toBe("/approvals");
	});

	it("stores null when a notification has no destination", () => {
		const record = buildNotificationRecord({
			userId: "user-1",
			type: "notice",
			title: "Notice",
			body: "No action required.",
		});

		expect(record.actionUrl).toBeNull();
	});
});
