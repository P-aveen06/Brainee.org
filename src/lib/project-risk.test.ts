import { describe, expect, it } from "vitest";
import { evaluateProjectRisks, type ProjectRiskSnapshot } from "./project-risk";

describe("evaluateProjectRisks", () => {
	const baseSnapshot: ProjectRiskSnapshot = {
		projectId: "p1",
		projectCode: "PRJ-001",
		projectName: "Apollo",
		status: "active",
		currentStageKey: "development",
		today: "2026-08-29",
		tasks: [],
		checklistItems: [],
		documents: [],
		recentEventCount: 5,
	};

	it("returns zero risks for archived or completed projects", () => {
		const archived = evaluateProjectRisks({
			...baseSnapshot,
			status: "archived",
			tasks: [{ id: "t1", status: "todo", dueDate: "2026-08-01" }],
		});
		expect(archived).toHaveLength(0);
	});

	it("flags overdue tasks accurately", () => {
		const res = evaluateProjectRisks({
			...baseSnapshot,
			tasks: [
				{ id: "t1", status: "todo", dueDate: "2026-08-20" },
				{ id: "t2", status: "in_progress", dueDate: "2026-08-25" },
				{ id: "t3", status: "done", dueDate: "2026-08-20" }, // done, should not flag
			],
		});

		const overdue = res.find((r) => r.code === "overdue_tasks");
		expect(overdue).toBeDefined();
		expect(overdue?.evidence.count).toBe(2);
	});

	it("flags unassigned open tasks", () => {
		const res = evaluateProjectRisks({
			...baseSnapshot,
			tasks: [
				{ id: "t1", status: "todo", assigneeId: null },
				{ id: "t2", status: "in_progress", assigneeId: "u1" },
			],
		});

		const unassigned = res.find((r) => r.code === "unassigned_open_tasks");
		expect(unassigned).toBeDefined();
		expect(unassigned?.evidence.count).toBe(1);
	});

	it("flags key person concentration when one contributor holds >60% of open work", () => {
		const res = evaluateProjectRisks({
			...baseSnapshot,
			tasks: [
				{ id: "t1", status: "in_progress", assigneeId: "u1" },
				{ id: "t2", status: "in_progress", assigneeId: "u1" },
				{ id: "t3", status: "in_progress", assigneeId: "u1" },
				{ id: "t4", status: "todo", assigneeId: "u1" },
				{ id: "t5", status: "todo", assigneeId: "u2" },
			],
		});

		const keyPerson = res.find((r) => r.code === "key_person_concentration");
		expect(keyPerson).toBeDefined();
		expect(keyPerson?.evidence.assigneeId).toBe("u1");
	});

	it("flags required checklist incomplete for the current stage", () => {
		const res = evaluateProjectRisks({
			...baseSnapshot,
			checklistItems: [
				{ stageKey: "development", isRequired: true, status: "pending" },
				{ stageKey: "development", isRequired: false, status: "pending" },
				{ stageKey: "discovery", isRequired: true, status: "pending" }, // different stage
			],
		});

		const checklist = res.find(
			(r) => r.code === "required_checklist_incomplete",
		);
		expect(checklist).toBeDefined();
		expect(checklist?.evidence.pendingRequiredCount).toBe(1);
	});

	it("flags target_date_at_risk when target date is approaching within 7 days", () => {
		const res = evaluateProjectRisks({
			...baseSnapshot,
			targetEndDate: "2026-09-02", // 4 days from 2026-08-29
			tasks: [{ id: "t1", status: "in_progress", assigneeId: "u1" }],
		});

		const dateRisk = res.find((r) => r.code === "target_date_at_risk");
		expect(dateRisk).toBeDefined();
		expect(dateRisk?.severity).toBe("high");
	});

	it("flags critical severity when target date has already passed with open tasks", () => {
		const res = evaluateProjectRisks({
			...baseSnapshot,
			targetEndDate: "2026-08-25", // 4 days ago
			tasks: [{ id: "t1", status: "in_progress", assigneeId: "u1" }],
		});

		const dateRisk = res.find((r) => r.code === "target_date_at_risk");
		expect(dateRisk).toBeDefined();
		expect(dateRisk?.severity).toBe("critical");
	});

	it("flags no_recent_activity when recent event count is 0", () => {
		const res = evaluateProjectRisks({
			...baseSnapshot,
			recentEventCount: 0,
		});

		const noAct = res.find((r) => r.code === "no_recent_activity");
		expect(noAct).toBeDefined();
	});
});
