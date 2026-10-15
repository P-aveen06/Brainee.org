/**
 * Deterministic Project Risk Signal Evaluator.
 * Pure logic: zero DB calls, zero side effects.
 * Shared by both UI risk indicators and AI Assistant risk tools.
 */

export interface RiskSignal {
	code: string;
	severity: "low" | "medium" | "high" | "critical";
	message: string;
	evidence: Record<string, unknown>;
}

export interface ProjectRiskSnapshot {
	projectId: string;
	projectCode: string;
	projectName: string;
	status: string;
	currentStageKey: string;
	targetEndDate?: string | null;
	today: string;
	tasks: Array<{
		id: string;
		status: string;
		dueDate?: string | null;
		assigneeId?: string | null;
	}>;
	checklistItems: Array<{
		stageKey: string;
		isRequired: boolean;
		status: string;
	}>;
	documents: Array<{
		stageKey?: string | null;
		category: string;
	}>;
	recentEventCount: number;
	lastEventDate?: string | null;
	missingEodCount?: number;
}

export function evaluateProjectRisks(
	snapshot: ProjectRiskSnapshot,
): RiskSignal[] {
	const signals: RiskSignal[] = [];

	if (snapshot.status === "archived" || snapshot.status === "completed") {
		return signals;
	}

	const todayMs = new Date(snapshot.today).getTime();

	// 1. Overdue Tasks
	const overdueTasks = snapshot.tasks.filter((t) => {
		if (t.status === "done" || t.status === "cancelled") return false;
		if (!t.dueDate) return false;
		return new Date(t.dueDate).getTime() < todayMs;
	});

	if (overdueTasks.length > 0) {
		signals.push({
			code: "overdue_tasks",
			severity: overdueTasks.length >= 3 ? "high" : "medium",
			message: `${overdueTasks.length} task(s) past due date without completion.`,
			evidence: {
				count: overdueTasks.length,
				overdueTaskIds: overdueTasks.map((t) => t.id),
			},
		});
	}

	// 2. Unassigned Open Tasks
	const unassignedOpen = snapshot.tasks.filter((t) => {
		if (t.status === "done" || t.status === "cancelled") return false;
		return !t.assigneeId;
	});

	if (unassignedOpen.length > 0) {
		signals.push({
			code: "unassigned_open_tasks",
			severity: unassignedOpen.length >= 5 ? "medium" : "low",
			message: `${unassignedOpen.length} open task(s) have no assigned team member.`,
			evidence: { count: unassignedOpen.length },
		});
	}

	// 3. Key Person Concentration (> 60% of open work on one person)
	const openTasks = snapshot.tasks.filter(
		(t) => t.status !== "done" && t.status !== "cancelled" && t.assigneeId,
	);
	if (openTasks.length >= 4) {
		const assigneeCounts: Record<string, number> = {};
		for (const t of openTasks) {
			if (t.assigneeId) {
				assigneeCounts[t.assigneeId] = (assigneeCounts[t.assigneeId] || 0) + 1;
			}
		}
		for (const [assigneeId, count] of Object.entries(assigneeCounts)) {
			const ratio = count / openTasks.length;
			if (ratio > 0.6) {
				signals.push({
					code: "key_person_concentration",
					severity: "medium",
					message: `Single contributor holds ${Math.round(ratio * 100)}% of all active project tasks.`,
					evidence: {
						assigneeId,
						taskCount: count,
						totalOpen: openTasks.length,
						ratio,
					},
				});
				break;
			}
		}
	}

	// 4. Required Checklist Incomplete
	const stageChecklist = snapshot.checklistItems.filter(
		(c) => c.stageKey === snapshot.currentStageKey,
	);
	const pendingRequired = stageChecklist.filter(
		(c) => c.isRequired && c.status !== "done" && c.status !== "not_applicable",
	);

	if (pendingRequired.length > 0 && stageChecklist.length > 0) {
		signals.push({
			code: "required_checklist_incomplete",
			severity: "medium",
			message: `${pendingRequired.length} required stage gate checklist item(s) pending for '${snapshot.currentStageKey}'.`,
			evidence: {
				currentStageKey: snapshot.currentStageKey,
				pendingRequiredCount: pendingRequired.length,
			},
		});
	}

	// 5. Target Date Approaching with Pending Work
	if (snapshot.targetEndDate) {
		const targetMs = new Date(snapshot.targetEndDate).getTime();
		const daysRemaining = Math.ceil((targetMs - todayMs) / (1000 * 3600 * 24));
		const activeCount = snapshot.tasks.filter(
			(t) => t.status !== "done" && t.status !== "cancelled",
		).length;

		if (daysRemaining <= 7 && daysRemaining >= 0 && activeCount > 0) {
			signals.push({
				code: "target_date_at_risk",
				severity: daysRemaining <= 3 ? "critical" : "high",
				message: `Target completion date is in ${daysRemaining} day(s) with ${activeCount} task(s) remaining open.`,
				evidence: {
					targetEndDate: snapshot.targetEndDate,
					daysRemaining,
					openTasksRemaining: activeCount,
				},
			});
		} else if (daysRemaining < 0 && activeCount > 0) {
			signals.push({
				code: "target_date_at_risk",
				severity: "critical",
				message: `Project target end date was ${Math.abs(daysRemaining)} day(s) ago with ${activeCount} unfinished tasks.`,
				evidence: {
					targetEndDate: snapshot.targetEndDate,
					daysOverdue: Math.abs(daysRemaining),
					openTasksRemaining: activeCount,
				},
			});
		}
	}

	// 6. No Recent Activity
	if (snapshot.recentEventCount === 0) {
		signals.push({
			code: "no_recent_activity",
			severity: "low",
			message:
				"No project timeline events or activity recorded in the last 7 days.",
			evidence: { recentEventCount: 0, lastEventDate: snapshot.lastEventDate },
		});
	}

	// 7. EOD Compliance (Missing updates)
	if (snapshot.missingEodCount && snapshot.missingEodCount >= 2) {
		signals.push({
			code: "eod_compliance",
			severity: "medium",
			message: `${snapshot.missingEodCount} team members have outstanding daily standup submissions for this project.`,
			evidence: { missingSubmitterCount: snapshot.missingEodCount },
		});
	}

	return signals;
}
