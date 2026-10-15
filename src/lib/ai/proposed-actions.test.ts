import { describe, expect, it } from "vitest";
import { parseProposedAction } from "./proposed-actions";

describe("parseProposedAction", () => {
	it("accepts an allowlisted action with its expected payload", () => {
		expect(
			parseProposedAction("request_leave", {
				leaveType: "sick-leave",
				startDate: "2026-08-31",
				endDate: "2026-08-31",
			}),
		).toMatchObject({ success: true });
	});

	it("rejects unknown action types", () => {
		expect(parseProposedAction("delete_project", {}).success).toBe(false);
	});

	it("rejects malformed payloads", () => {
		expect(parseProposedAction("report_asset_issue", {}).success).toBe(false);
	});

	it("accepts a confirmation-gated project task", () => {
		expect(
			parseProposedAction("create_task", {
				projectId: "project-1",
				title: "Confirm revised launch date",
				priority: "high",
				dueDate: "2026-09-03",
			}),
		).toMatchObject({ success: true });
	});

	it("accepts an allowlisted leave cancellation", () => {
		expect(
			parseProposedAction("cancel_leave_request", {
				leaveRequestId: "leave-1",
			}),
		).toMatchObject({ success: true });
	});

	it("rejects a project task without a title", () => {
		expect(
			parseProposedAction("create_task", {
				projectId: "project-1",
				priority: "medium",
			}),
		).toMatchObject({ success: false });
	});
});
