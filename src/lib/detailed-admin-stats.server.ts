import { and, desc, eq, gte, inArray, lte } from "@/db/graph-query";
import type { Database } from "../db";
import {
	companies,
	leaveBalances,
	leaveRequests,
	projects,
	projectTasks,
	timesheets,
	users,
	wfhRequests,
} from "../db/schema";
import { addIsoDays, getTodayIsoDate } from "./leave-policy";

export interface StatsFilters {
	userId?: string;
	startDate?: string;
	endDate?: string;
	status?: string;
}

export interface ProjectExecutiveSummary {
	id: string;
	code: string;
	name: string;
	clientName: string | null;
	status: string;
	health: "green" | "amber" | "red";
	stageKey: string | null;
	targetEndDate: string | null;
	ownerName: string | null;
	totalTasks: number;
	openTasks: number;
	blockedTasks: number;
}

export interface CriticalBlocker {
	id: string;
	taskNumber: number;
	title: string;
	blockedReason: string | null;
	dueDate: string | null;
	projectCode: string;
	projectName: string;
	clientName: string | null;
	assigneeName: string | null;
}

export interface TodayPresence {
	inOffice: number;
	wfh: number;
	onLeave: number;
	total: number;
	wfhUsers: string[];
	onLeaveUsers: string[];
}

export interface PendingApprovalItem {
	id: string;
	userId: string;
	userName: string;
	type: "leave" | "wfh";
	dates: string;
	reason: string | null;
}

export interface EmployeeAssignedTask {
	id: string;
	taskNumber: number;
	projectCode: string;
	projectName: string;
	title: string;
	status: string;
	blockedReason: string | null;
	dueDate: string | null;
}

export interface DetailedAdminStatsData {
	employees: {
		id: string;
		name: string;
		email: string;
		avatar_url: string | null;
		role: string;
	}[];
	timesheets30Days: {
		date: string;
		hours: number;
		user_id: string;
		user_name: string;
	}[];
	leaveBalances: {
		user_id: string;
		leave_type: string;
		total_limit: number;
		used: number;
	}[];
	recentRequests: {
		id: string;
		user_id: string;
		user_name: string;
		type: "leave" | "wfh";
		status: string;
		start_date: string;
		end_date: string;
		reason: string | null;
	}[];
	summary: {
		totalHoursWorked: number;
		approvedWfhDays: number;
		approvedLeaveDays: number;
		pendingApprovals: number;
		activeProjectsCount: number;
		healthyProjectsCount: number;
		atRiskProjectsCount: number;
		criticalBlockersCount: number;
	};
	projects: ProjectExecutiveSummary[];
	criticalBlockers: CriticalBlocker[];
	todayPresence: TodayPresence;
	pendingApprovalsList: PendingApprovalItem[];
	employeeTasks: Record<string, EmployeeAssignedTask[]>;
	selectedUserId?: string;
}

function getOverlapDays(
	start: string,
	end: string,
	rangeStart: string,
	rangeEnd: string,
): number {
	const s = new Date(start > rangeStart ? start : rangeStart);
	const e = new Date(end < rangeEnd ? end : rangeEnd);
	if (s > e) return 0;
	const diffTime = Math.abs(e.getTime() - s.getTime());
	return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export async function getDetailedAdminStats(
	db: Database,
	filters: StatsFilters = {},
): Promise<DetailedAdminStatsData> {
	// Date range defaults: last 30 days
	const today = getTodayIsoDate();
	const startDateIso = filters.startDate || addIsoDays(today, -30);
	const endDateIso = filters.endDate || today;

	// 1. Fetch Users
	const dbUsers = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			avatarUrl: users.avatarUrl,
			role: users.role,
		})
		.from(users)
		.orderBy(users.name);

	// 2. Fetch Timesheets across team for the selected date range
	const timesheetFilters = [
		gte(timesheets.date, startDateIso),
		lte(timesheets.date, endDateIso),
	];
	const dbTimesheets = await db
		.select({
			date: timesheets.date,
			hours: timesheets.hours,
			userId: timesheets.userId,
			userName: users.name,
		})
		.from(timesheets)
		.leftJoin(users, eq(timesheets.userId, users.id))
		.where(and(...timesheetFilters));

	// 3. Fetch Balances
	const dbBalances = await db
		.select({
			userId: leaveBalances.userId,
			leaveType: leaveBalances.leaveType,
			totalLimit: leaveBalances.totalLimit,
			used: leaveBalances.used,
		})
		.from(leaveBalances);

	// 4. Fetch Leaves with filters
	const leaveFilters = [
		gte(leaveRequests.endDate, startDateIso),
		lte(leaveRequests.startDate, endDateIso),
	];
	if (filters.status && filters.status !== "all") {
		leaveFilters.push(eq(leaveRequests.status, filters.status));
	}
	const dbLeaves = await db
		.select({
			id: leaveRequests.id,
			userId: leaveRequests.userId,
			status: leaveRequests.status,
			startDate: leaveRequests.startDate,
			endDate: leaveRequests.endDate,
			reason: leaveRequests.reason,
			userName: users.name,
			createdAt: leaveRequests.createdAt,
		})
		.from(leaveRequests)
		.leftJoin(users, eq(leaveRequests.userId, users.id))
		.where(and(...leaveFilters))
		.orderBy(desc(leaveRequests.createdAt));

	// 5. Fetch WFH with filters
	const wfhFilters = [
		gte(wfhRequests.date, startDateIso),
		lte(wfhRequests.date, endDateIso),
	];
	if (filters.status && filters.status !== "all") {
		wfhFilters.push(eq(wfhRequests.status, filters.status));
	}
	const dbWfh = await db
		.select({
			id: wfhRequests.id,
			userId: wfhRequests.userId,
			status: wfhRequests.status,
			date: wfhRequests.date,
			reason: wfhRequests.reason,
			userName: users.name,
			createdAt: wfhRequests.createdAt,
		})
		.from(wfhRequests)
		.leftJoin(users, eq(wfhRequests.userId, users.id))
		.where(and(...wfhFilters))
		.orderBy(desc(wfhRequests.createdAt));

	// Format dataset
	const employees = dbUsers.map((u) => ({
		id: u.id,
		name: u.name || "Unknown",
		email: u.email || "",
		avatar_url: u.avatarUrl,
		role: u.role,
	}));

	const timesheets30Days = dbTimesheets.map((t) => ({
		date: t.date,
		hours: Number(t.hours),
		user_id: t.userId,
		user_name: t.userName || "Unknown",
	}));

	const leaveBalancesData = dbBalances.map((b) => ({
		user_id: b.userId,
		leave_type: b.leaveType,
		total_limit: Number(b.totalLimit),
		used: Number(b.used),
	}));

	const recentRequests: DetailedAdminStatsData["recentRequests"] = [];

	dbLeaves.forEach((l) => {
		recentRequests.push({
			id: l.id,
			user_id: l.userId,
			user_name: l.userName || "Unknown",
			type: "leave",
			status: l.status,
			start_date: l.startDate,
			end_date: l.endDate,
			reason: l.reason,
		});
	});

	dbWfh.forEach((w) => {
		recentRequests.push({
			id: w.id,
			user_id: w.userId,
			user_name: w.userName || "Unknown",
			type: "wfh",
			status: w.status,
			start_date: w.date,
			end_date: w.date,
			reason: w.reason,
		});
	});

	recentRequests.sort((a, b) => b.start_date.localeCompare(a.start_date));

	// Compute stats summary matching selected employee & date range
	const totalHoursWorked = timesheets30Days.reduce(
		(sum, t) => sum + t.hours,
		0,
	);

	const approvedWfhDays = recentRequests.filter(
		(r) => r.type === "wfh" && r.status === "approved",
	).length;

	let approvedLeaveDays = 0;
	recentRequests.forEach((r) => {
		if (r.type === "leave" && r.status === "approved") {
			approvedLeaveDays += getOverlapDays(
				r.start_date,
				r.end_date,
				startDateIso,
				endDateIso,
			);
		}
	});

	const pendingApprovals = recentRequests.filter(
		(r) => r.status === "pending",
	).length;

	// 6. Fetch Projects for Executive Overview
	const dbProjects = await db
		.select({
			id: projects.id,
			code: projects.code,
			name: projects.name,
			status: projects.status,
			healthOverride: projects.healthOverride,
			stageKey: projects.currentStageKey,
			targetEndDate: projects.targetEndDate,
			clientName: companies.name,
			ownerName: users.name,
			updatedAt: projects.updatedAt,
		})
		.from(projects)
		.leftJoin(companies, eq(projects.clientCompanyId, companies.id))
		.leftJoin(users, eq(projects.ownerId, users.id))
		.where(inArray(projects.status, ["active", "on_hold"]))
		.orderBy(desc(projects.updatedAt));

	// 7. Fetch Project Tasks for Delivery Health & Critical Blockers
	const dbTasks = await db
		.select({
			id: projectTasks.id,
			taskNumber: projectTasks.taskNumber,
			projectId: projectTasks.projectId,
			title: projectTasks.title,
			status: projectTasks.status,
			blockedReason: projectTasks.blockedReason,
			dueDate: projectTasks.dueDate,
			assigneeName: users.name,
		})
		.from(projectTasks)
		.leftJoin(users, eq(projectTasks.assigneeId, users.id));

	const projectTasksMap = new Map<
		string,
		{ total: number; open: number; blocked: number }
	>();
	const criticalBlockers: CriticalBlocker[] = [];
	const projectInfoMap = new Map(dbProjects.map((p) => [p.id, p]));

	for (const t of dbTasks) {
		const counts = projectTasksMap.get(t.projectId) || {
			total: 0,
			open: 0,
			blocked: 0,
		};
		counts.total++;
		if (t.status !== "done" && t.status !== "cancelled") {
			counts.open++;
		}
		if (t.status === "blocked") {
			counts.blocked++;
			const proj = projectInfoMap.get(t.projectId);
			if (proj && t.blockedReason) {
				criticalBlockers.push({
					id: t.id,
					taskNumber: t.taskNumber || 0,
					title: t.title,
					blockedReason: t.blockedReason,
					dueDate: t.dueDate,
					projectCode: proj.code,
					projectName: proj.name,
					clientName: proj.clientName,
					assigneeName: t.assigneeName,
				});
			}
		}
		projectTasksMap.set(t.projectId, counts);
	}

	const executiveProjects: ProjectExecutiveSummary[] = dbProjects.map((p) => {
		const taskCounts = projectTasksMap.get(p.id) || {
			total: 0,
			open: 0,
			blocked: 0,
		};
		let health: "green" | "amber" | "red" = "green";
		if (
			p.healthOverride === "red" ||
			p.healthOverride === "amber" ||
			p.healthOverride === "green"
		) {
			health = p.healthOverride;
		} else if (taskCounts.blocked > 0) {
			health = "amber";
		}
		return {
			id: p.id,
			code: p.code,
			name: p.name,
			clientName: p.clientName,
			status: p.status,
			health,
			stageKey: p.stageKey,
			targetEndDate: p.targetEndDate,
			ownerName: p.ownerName,
			totalTasks: taskCounts.total,
			openTasks: taskCounts.open,
			blockedTasks: taskCounts.blocked,
		};
	});

	const activeProjectsCount = executiveProjects.filter(
		(p) => p.status === "active",
	).length;
	const healthyProjectsCount = executiveProjects.filter(
		(p) => p.health === "green",
	).length;
	const atRiskProjectsCount = executiveProjects.filter(
		(p) => p.health === "amber" || p.health === "red",
	).length;

	// 8. Compute Today's Presence Pulse
	const todayIso = getTodayIsoDate();
	const wfhTodayUsers = new Set(
		dbWfh
			.filter((w) => w.status === "approved" && w.date === todayIso)
			.map((w) => w.userName || "Teammate"),
	);
	const onLeaveTodayUsers = new Set(
		dbLeaves
			.filter(
				(l) =>
					l.status === "approved" &&
					l.startDate <= todayIso &&
					l.endDate >= todayIso,
			)
			.map((l) => l.userName || "Teammate"),
	);
	const totalTeamSize = dbUsers.length;
	const wfhCount = wfhTodayUsers.size;
	const onLeaveCount = onLeaveTodayUsers.size;
	const inOfficeCount = Math.max(0, totalTeamSize - wfhCount - onLeaveCount);

	const todayPresence: TodayPresence = {
		inOffice: inOfficeCount,
		wfh: wfhCount,
		onLeave: onLeaveCount,
		total: totalTeamSize,
		wfhUsers: Array.from(wfhTodayUsers),
		onLeaveUsers: Array.from(onLeaveTodayUsers),
	};

	// 9. Pending Approvals list
	const pendingApprovalsList: PendingApprovalItem[] = recentRequests
		.filter((r) => r.status === "pending")
		.map((r) => ({
			id: r.id,
			userId: r.user_id,
			userName: r.user_name,
			type: r.type,
			dates:
				r.start_date === r.end_date
					? r.start_date
					: `${r.start_date} to ${r.end_date}`,
			reason: r.reason,
		}));
	// 10. Map Assigned Tasks per Teammate for rich drill-down
	const employeeTasks: Record<string, EmployeeAssignedTask[]> = {};
	for (const t of dbTasks) {
		if (t.assigneeName) {
			const assigneeUser = dbUsers.find((u) => u.name === t.assigneeName);
			const userId = assigneeUser?.id;
			if (userId) {
				if (!employeeTasks[userId]) {
					employeeTasks[userId] = [];
				}
				const proj = projectInfoMap.get(t.projectId);
				employeeTasks[userId].push({
					id: t.id,
					taskNumber: t.taskNumber || 0,
					projectCode: proj?.code || "PRJ",
					projectName: proj?.name || "Project",
					title: t.title,
					status: t.status,
					blockedReason: t.blockedReason,
					dueDate: t.dueDate,
				});
			}
		}
	}

	return {
		employees,
		timesheets30Days,
		leaveBalances: leaveBalancesData,
		recentRequests,
		summary: {
			totalHoursWorked,
			approvedWfhDays,
			approvedLeaveDays,
			pendingApprovals,
			activeProjectsCount,
			healthyProjectsCount,
			atRiskProjectsCount,
			criticalBlockersCount: criticalBlockers.length,
		},
		projects: executiveProjects,
		criticalBlockers,
		todayPresence,
		pendingApprovalsList,
		employeeTasks,
		selectedUserId:
			filters.userId && filters.userId !== "all" ? filters.userId : undefined,
	};
}
