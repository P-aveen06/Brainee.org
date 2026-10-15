import { describe, expect, it } from "vitest";
import { assembleEodSkeleton, resolveEodSubmissionState } from "./eod-policy";

describe("resolveEodSubmissionState", () => {
	const members = [
		{ userId: "u1", userName: "Alice", role: "owner", isActive: true },
		{ userId: "u2", userName: "Bob", role: "manager", isActive: true },
		{ userId: "u3", userName: "Charlie", role: "contributor", isActive: true },
		{ userId: "u4", userName: "Diana", role: "viewer", isActive: true },
		{ userId: "u5", userName: "Evan", role: "contributor", isActive: false },
	];

	it("excludes viewer role and inactive departed members from expected submitters", () => {
		const state = resolveEodSubmissionState({
			members,
			submittedUpdates: [],
			callerRole: "contributor",
		});

		expect(state.expected).toEqual([
			{ userId: "u1", name: "Alice" },
			{ userId: "u2", name: "Bob" },
			{ userId: "u3", name: "Charlie" },
		]);
		expect(state.missing).toHaveLength(3);
		expect(state.allSubmitted).toBe(false);
		expect(state.canGenerate).toBe(false);
	});

	it("does not count draft status updates as submitted", () => {
		const state = resolveEodSubmissionState({
			members,
			submittedUpdates: [
				{ userId: "u1", status: "submitted" },
				{ userId: "u2", status: "draft" },
			],
			callerRole: "contributor",
		});

		expect(state.submitted).toEqual(["u1"]);
		expect(state.missing.map((m) => m.userId)).toEqual(["u2", "u3"]);
		expect(state.allSubmitted).toBe(false);
	});

	it("marks allSubmitted and canGenerate true when all expected have submitted", () => {
		const state = resolveEodSubmissionState({
			members,
			submittedUpdates: [
				{ userId: "u1", status: "submitted" },
				{ userId: "u2", status: "submitted" },
				{ userId: "u3", status: "submitted" },
			],
			callerRole: "contributor",
		});

		expect(state.allSubmitted).toBe(true);
		expect(state.missing).toHaveLength(0);
		expect(state.canGenerate).toBe(true);
	});

	it("allows manager or owner to override and generate even if updates are missing", () => {
		const state = resolveEodSubmissionState({
			members,
			submittedUpdates: [{ userId: "u1", status: "submitted" }],
			callerRole: "manager",
		});

		expect(state.allSubmitted).toBe(false);
		expect(state.canGenerate).toBe(true);
	});

	it("disallows non-manager contributor from generating when updates are missing", () => {
		const state = resolveEodSubmissionState({
			members,
			submittedUpdates: [{ userId: "u1", status: "submitted" }],
			callerRole: "contributor",
		});

		expect(state.allSubmitted).toBe(false);
		expect(state.canGenerate).toBe(false);
	});
});

describe("assembleEodSkeleton", () => {
	it("assembles structured corporate email EOD report without internal names or raw task numbers", () => {
		const skeleton = assembleEodSkeleton({
			projectCode: "PRJ-001",
			projectName: "Apollo Core",
			date: "2026-08-29",
			pocName: "Sarah",
			updates: [
				{
					userId: "u1",
					userName: "Alice",
					summary:
						"Finished authentication flow and wrote unit tests (Subtask #5 done).",
					hoursSpent: 7.5,
				},
				{
					userId: "u2",
					userName: "Bob",
					summary: "Worked on database migrations.",
					blockers: "Waiting on staging credentials for testing.",
					hoursSpent: 4,
				},
			],
			tasks: [
				{
					taskNumber: 12,
					title: "Configure Apple Pay checkout",
					status: "in_progress",
					dueDate: "2026-09-05",
				},
			],
			missingMembers: [{ userId: "u3", name: "Charlie" }],
		});

		expect(skeleton.contentDraft).toContain("Subject:");
		expect(skeleton.contentDraft).toContain(
			"[EOD Update] Apollo Core | 29 Aug 2026",
		);
		expect(skeleton.contentDraft).toContain("Hi Sarah,");
		expect(skeleton.contentDraft).toContain("Progress completed today:");
		expect(skeleton.contentDraft).toContain(
			"Finished authentication flow and wrote unit tests.",
		);
		// Must NOT contain internal developer names or "Subtask #5"
		expect(skeleton.contentDraft).not.toContain("Alice");
		expect(skeleton.contentDraft).not.toContain("Subtask #5");
		expect(skeleton.contentDraft).toContain("Currently in progress:");
		expect(skeleton.contentDraft).toContain(
			"Configure Apple Pay checkout — Expected completion: 05 Sep 2026",
		);
		expect(skeleton.contentDraft).toContain("Dependencies / support required:");
		expect(skeleton.contentDraft).toContain(
			"Waiting on staging credentials for testing.",
		);
	});
});
