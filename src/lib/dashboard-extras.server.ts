import {
	and,
	asc,
	count,
	countWhen,
	eq,
	gte,
	inArray,
	isNull,
	lt,
	lte,
	notInArray,
} from "@/db/graph-query";
import { createDb } from "../db";
import {
	dashboardLayouts,
	leaveRequests,
	projects,
	projectTasks,
	publicHolidays,
	timesheets,
	wfhPolicy,
	wfhRequests,
} from "../db/schema";
import {
	type CalendarEvent,
	eachDay,
	getCalendarEvents,
} from "./dashboard-calendar.server";
import {
	addIsoDays,
	getTodayIsoDate,
	OPERATIONALLY_ACTIVE_LEAVE_STATUSES,
} from "./leave-policy";
import { visibleProjectIdsFor } from "./project-access";
import {
	DEFAULT_WFH_ALLOWANCE,
	getWfhCycleBounds,
	WFH_POLICY_ID,
} from "./wfh-policy";

export interface DashboardTask {
	id: string;
	projectId: string;
	projectCode: string;
	title: string;
	status: string;
	priority: string;
	dueDate: string | null;
}

export interface DashboardExtras {
	layout: { id: string; hidden: boolean }[] | null;
	/** Daily hours for the last 60 days, so streaks can cross month boundaries. */
	hoursTrend: { date: string; hours: number }[];
	/** Public holidays and the user's own approved leave days in that window. */
	offDates: string[];
	/** Null when no birthday is set, since the WFH cycle is anchored to it. */
	wfhBalance: { total: number; used: number } | null;
	tasks: {
		summary: {
			open: number;
			overdue: number;
			dueToday: number;
			inProgress: number;
		};
		upcoming: DashboardTask[];
	};
	calendar: { month: string; events: CalendarEvent[] };
}

const TREND_DAYS = 60;

async function getWfhBalance(
	db: ReturnType<typeof createDb>,
	user: { id: string; birthday: string | null },
	today: string,
): Promise<DashboardExtras["wfhBalance"]> {
	if (!user.birthday) return null;
	const cycle = getWfhCycleBounds(user.birthday, today);
	const [[policy], rows] = await Promise.all([
		db
			.select({ annualAllowance: wfhPolicy.annualAllowance })
			.from(wfhPolicy)
			.where(eq(wfhPolicy.id, WFH_POLICY_ID))
			.limit(1),
		db
			.select({ isHalfDay: wfhRequests.isHalfDay })
			.from(wfhRequests)
			.where(
				and(
					eq(wfhRequests.userId, user.id),
					gte(wfhRequests.date, cycle.cycleStart),
					lte(wfhRequests.date, cycle.cycleEnd),
					inArray(wfhRequests.status, ["pending", "approved"]),
				),
			),
	]);
	return {
		total: Number(policy?.annualAllowance ?? DEFAULT_WFH_ALLOWANCE),
		used: rows.reduce((n, r) => n + (r.isHalfDay ? 0.5 : 1), 0),
	};
}

export async function getDashboardExtras(user: {
	id: string;
	role: string;
	birthday: string | null;
}): Promise<DashboardExtras> {
	const db = createDb();
	const today = getTodayIsoDate();
	const month = today.slice(0, 7);
	const trendStart = addIsoDays(today, -(TREND_DAYS - 1));

	const [
		savedRows,
		sheetRows,
		visible,
		events,
		wfhBalance,
		holidayRows,
		leaveRows,
	] = await Promise.all([
		db
			.select({ layout: dashboardLayouts.layout })
			.from(dashboardLayouts)
			.where(eq(dashboardLayouts.userId, user.id))
			.limit(1),
		db
			.select({ date: timesheets.date, hours: timesheets.hours })
			.from(timesheets)
			.where(
				and(
					eq(timesheets.userId, user.id),
					gte(timesheets.date, trendStart),
					lte(timesheets.date, today),
				),
			),
		visibleProjectIdsFor(db, user),
		getCalendarEvents(month),
		getWfhBalance(db, user, today),
		db
			.select({ date: publicHolidays.date })
			.from(publicHolidays)
			.where(
				and(
					gte(publicHolidays.date, trendStart),
					lte(publicHolidays.date, today),
				),
			),
		db
			.select({
				startDate: leaveRequests.startDate,
				endDate: leaveRequests.endDate,
			})
			.from(leaveRequests)
			.where(
				and(
					eq(leaveRequests.userId, user.id),
					inArray(leaveRequests.status, OPERATIONALLY_ACTIVE_LEAVE_STATUSES),
					lte(leaveRequests.startDate, today),
					gte(leaveRequests.endDate, trendStart),
				),
			),
	]);

	const offDates = [
		...new Set([
			...holidayRows.map((h) => h.date),
			...leaveRows.flatMap((l) =>
				eachDay(l.startDate, l.endDate, trendStart, today),
			),
		]),
	];

	let layout: DashboardExtras["layout"] = null;
	try {
		const parsed: unknown = savedRows[0]
			? JSON.parse(savedRows[0].layout)
			: null;
		// resolveLayout re-validates; this only needs to be serializable
		layout = Array.isArray(parsed)
			? (parsed as NonNullable<DashboardExtras["layout"]>)
			: null;
	} catch {
		layout = null;
	}

	const byDate = new Map<string, number>();
	for (const r of sheetRows)
		byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.hours);
	const hoursTrend = Array.from({ length: TREND_DAYS }, (_, i) => {
		const date = addIsoDays(trendStart, i);
		return { date, hours: byDate.get(date) ?? 0 };
	});

	const empty = { open: 0, overdue: 0, dueToday: 0, inProgress: 0 };
	if (visible !== "all" && visible.length === 0) {
		return {
			layout,
			hoursTrend,
			offDates,
			wfhBalance,
			tasks: { summary: empty, upcoming: [] },
			calendar: { month, events },
		};
	}

	const openMine = and(
		eq(projectTasks.assigneeId, user.id),
		notInArray(projectTasks.status, ["done", "cancelled"]),
		visible === "all" ? undefined : inArray(projectTasks.projectId, visible),
	);

	const [counts, upcoming] = await Promise.all([
		db
			.select({
				open: count(),
				overdue: countWhen(lt(projectTasks.dueDate, today)),
				dueToday: countWhen(eq(projectTasks.dueDate, today)),
				inProgress: countWhen(eq(projectTasks.status, "in_progress")),
			})
			.from(projectTasks)
			.where(openMine),
		db
			.select({
				id: projectTasks.id,
				projectId: projectTasks.projectId,
				projectCode: projects.code,
				title: projectTasks.title,
				status: projectTasks.status,
				priority: projectTasks.priority,
				dueDate: projectTasks.dueDate,
			})
			.from(projectTasks)
			.innerJoin(projects, eq(projectTasks.projectId, projects.id))
			.where(openMine)
			// SQLite sorts NULL first ascending; keep undated tasks last.
			.orderBy(isNull(projectTasks.dueDate), asc(projectTasks.dueDate))
			.limit(8),
	]);

	return {
		layout,
		hoursTrend,
		offDates,
		wfhBalance,
		tasks: { summary: counts[0] ?? empty, upcoming },
		calendar: { month, events },
	};
}
