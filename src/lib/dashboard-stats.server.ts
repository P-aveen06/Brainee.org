import { env } from "cloudflare:workers";
import { and, desc, eq, gt, gte, inArray, lte } from "drizzle-orm";
import { createDb } from "#/db";
import {
	leaveBalances,
	leaveRequests,
	timesheets,
	users,
	wfhRequests,
} from "#/db/schema";
import { getPendingApprovalCount } from "./approval-count.server";
import { formatDateDisplay } from "./date-format";
import { ensureBalancesForCycle } from "./leave-balances.server";
import {
	addIsoDays,
	formatLeaveType,
	getTodayIsoDate,
	OPERATIONALLY_ACTIVE_LEAVE_STATUSES,
} from "./leave-policy";

type DashboardUser = {
	id: string;
	role: string;
	birthday: string | null;
	joinDate: string | null;
};

export interface LeaveBalanceBreakdownItem {
	leaveType: string;
	total: number;
	used: number;
}

export interface PersonalStats {
	hoursThisMonth: number;
	leaveBalanceUsed: number;
	leaveBalanceTotal: number;
	leaveBalanceBreakdown: LeaveBalanceBreakdownItem[];
	pendingRequests: number;
	daysWorkedThisMonth: number;
}

export interface TeamStats {
	teamHoursToday: number;
	pendingApprovals: number;
	onLeaveToday: number;
	teamSize: number;
}

function getMonthRange() {
	const today = getTodayIsoDate();
	const [yearStr, monthStr] = today.split("-");
	const year = Number(yearStr);
	const month = Number(monthStr);
	const start = `${yearStr}-${monthStr}-01`;
	const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
	const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
	return { start, end };
}

export async function getPersonalStats(
	user: DashboardUser,
): Promise<PersonalStats> {
	const db = createDb(env.DATABASE);
	const { start, end } = getMonthRange();
	const cycle = user.birthday ? await ensureBalancesForCycle(db, user) : null;

	// 1. Fetch timesheets
	const userTimesheets = await db
		.select({
			hours: timesheets.hours,
			date: timesheets.date,
		})
		.from(timesheets)
		.where(
			and(
				eq(timesheets.userId, user.id),
				gte(timesheets.date, start),
				lte(timesheets.date, end),
			),
		);

	// 2. Fetch current-cycle leave balances
	const balances = cycle
		? await db
				.select({
					leaveType: leaveBalances.leaveType,
					totalLimit: leaveBalances.totalLimit,
					used: leaveBalances.used,
				})
				.from(leaveBalances)
				.where(
					and(
						eq(leaveBalances.userId, user.id),
						eq(leaveBalances.cycleStart, cycle.cycleStart),
					),
				)
		: [];

	// 3. Fetch pending leave requests
	const pendingLeaves = await db
		.select({ id: leaveRequests.id })
		.from(leaveRequests)
		.where(
			and(
				eq(leaveRequests.userId, user.id),
				eq(leaveRequests.status, "pending"),
			),
		);

	// 4. Fetch pending wfh requests
	const pendingWfh = await db
		.select({ id: wfhRequests.id })
		.from(wfhRequests)
		.where(
			and(eq(wfhRequests.userId, user.id), eq(wfhRequests.status, "pending")),
		);

	const hoursThisMonth = userTimesheets.reduce((sum, t) => sum + t.hours, 0);
	const uniqueDates = new Set(userTimesheets.map((t) => t.date));

	const leaveBalanceTotal = balances.reduce((sum, b) => sum + b.totalLimit, 0);
	const leaveBalanceUsed = balances.reduce((sum, b) => sum + b.used, 0);
	const leaveBalanceBreakdown = balances.map((b) => ({
		leaveType: b.leaveType,
		total: b.totalLimit,
		used: b.used,
	}));

	const pendingRequests = pendingLeaves.length + pendingWfh.length;

	return {
		hoursThisMonth,
		leaveBalanceUsed,
		leaveBalanceTotal,
		leaveBalanceBreakdown,
		pendingRequests,
		daysWorkedThisMonth: uniqueDates.size,
	};
}

export async function getTeamStats(user: DashboardUser): Promise<TeamStats> {
	const db = createDb(env.DATABASE);
	const today = getTodayIsoDate();

	// 1. Fetch team hours today
	const todaySheets = await db
		.select({ hours: timesheets.hours })
		.from(timesheets)
		.where(eq(timesheets.date, today));

	const canApprove = user.role === "lead" || user.role === "admin";
	const pendingLeaves = canApprove
		? await db
				.select({ id: leaveRequests.id })
				.from(leaveRequests)
				.innerJoin(users, eq(leaveRequests.userId, users.id))
				.where(
					user.role === "admin"
						? eq(leaveRequests.status, "pending")
						: and(
								eq(leaveRequests.status, "pending"),
								eq(users.peerLeadId, user.id),
							),
				)
		: [];

	const pendingWfh = canApprove
		? await db
				.select({ id: wfhRequests.id })
				.from(wfhRequests)
				.innerJoin(users, eq(wfhRequests.userId, users.id))
				.where(
					user.role === "admin"
						? eq(wfhRequests.status, "pending")
						: and(
								eq(wfhRequests.status, "pending"),
								eq(users.peerLeadId, user.id),
							),
				)
		: [];

	// 4. Fetch leaves today
	const leavesToday = await db
		.select({ id: leaveRequests.id })
		.from(leaveRequests)
		.where(
			and(
				inArray(leaveRequests.status, OPERATIONALLY_ACTIVE_LEAVE_STATUSES),
				lte(leaveRequests.startDate, today),
				gte(leaveRequests.endDate, today),
			),
		);

	// 5. Fetch total user count
	const allUsers = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.isActive, true));

	const teamHoursToday = todaySheets.reduce((sum, t) => sum + t.hours, 0);
	const pendingApprovals = pendingLeaves.length + pendingWfh.length;

	return {
		teamHoursToday,
		pendingApprovals,
		onLeaveToday: leavesToday.length,
		teamSize: allUsers.length,
	};
}

export async function getDashboardData(user: DashboardUser) {
	const db = createDb(env.DATABASE);
	const today = getTodayIsoDate();
	const canApprove = user.role === "lead" || user.role === "admin";

	// 1. Personal stats
	const personalStatsPromise = getPersonalStats(user);

	// 2. Team stats
	const teamStatsPromise = getTeamStats(user);

	// 3. Existing timesheet log for today
	const existingLogPromise = db
		.select({ id: timesheets.id, hours: timesheets.hours })
		.from(timesheets)
		.where(and(eq(timesheets.userId, user.id), eq(timesheets.date, today)))
		.limit(1)
		.then((res) => res[0] || null);

	// 4. Upcoming leaves (next 14 days)
	const endDate = addIsoDays(today, 14);
	const upcomingLeavesPromise = db
		.select({
			id: leaveRequests.id,
			startDate: leaveRequests.startDate,
			endDate: leaveRequests.endDate,
			leaveType: leaveRequests.leaveType,
			totalDays: leaveRequests.totalDays,
			userName: users.name,
			userAvatar: users.avatarUrl,
		})
		.from(leaveRequests)
		.innerJoin(users, eq(leaveRequests.userId, users.id))
		.where(
			and(
				inArray(leaveRequests.status, OPERATIONALLY_ACTIVE_LEAVE_STATUSES),
				gt(leaveRequests.startDate, today),
				lte(leaveRequests.startDate, endDate),
			),
		)
		.orderBy(leaveRequests.startDate)
		.limit(6);

	// 5. Team availability today (leaves & WFH today)
	const leavesTodayPromise = db
		.select({
			leaveType: leaveRequests.leaveType,
			userName: users.name,
			userAvatar: users.avatarUrl,
		})
		.from(leaveRequests)
		.innerJoin(users, eq(leaveRequests.userId, users.id))
		.where(
			and(
				inArray(leaveRequests.status, OPERATIONALLY_ACTIVE_LEAVE_STATUSES),
				lte(leaveRequests.startDate, today),
				gte(leaveRequests.endDate, today),
			),
		);

	const wfhTodayPromise = db
		.select({
			userName: users.name,
			userAvatar: users.avatarUrl,
		})
		.from(wfhRequests)
		.innerJoin(users, eq(wfhRequests.userId, users.id))
		.where(
			and(eq(wfhRequests.status, "approved"), eq(wfhRequests.date, today)),
		);

	// 6. Upcoming birthdays (next 30 days)
	const allUsersWithBirthdaysPromise = db
		.select({
			id: users.id,
			name: users.name,
			avatarUrl: users.avatarUrl,
			birthday: users.birthday,
		})
		.from(users)
		.where(eq(users.isActive, true));

	// 7. Recent requests of user
	const recentLeavesPromise = db
		.select({
			id: leaveRequests.id,
			leaveType: leaveRequests.leaveType,
			startDate: leaveRequests.startDate,
			endDate: leaveRequests.endDate,
			status: leaveRequests.status,
			createdAt: leaveRequests.createdAt,
		})
		.from(leaveRequests)
		.where(eq(leaveRequests.userId, user.id))
		.orderBy(desc(leaveRequests.createdAt))
		.limit(4);

	const recentWfhsPromise = db
		.select({
			id: wfhRequests.id,
			date: wfhRequests.date,
			status: wfhRequests.status,
			createdAt: wfhRequests.createdAt,
		})
		.from(wfhRequests)
		.where(eq(wfhRequests.userId, user.id))
		.orderBy(desc(wfhRequests.createdAt))
		.limit(3);

	// 8. Pending approvals preview (leaves & wfh requests pending)
	const pendingLeavesPromise = canApprove
		? db
				.select({
					id: leaveRequests.id,
					leaveType: leaveRequests.leaveType,
					startDate: leaveRequests.startDate,
					endDate: leaveRequests.endDate,
					totalDays: leaveRequests.totalDays,
					userName: users.name,
					userAvatar: users.avatarUrl,
					createdAt: leaveRequests.createdAt,
				})
				.from(leaveRequests)
				.innerJoin(users, eq(leaveRequests.userId, users.id))
				.where(
					user.role === "admin"
						? eq(leaveRequests.status, "pending")
						: and(
								eq(leaveRequests.status, "pending"),
								eq(users.peerLeadId, user.id),
							),
				)
				.orderBy(desc(leaveRequests.createdAt))
				.limit(10)
		: Promise.resolve([]);

	const pendingWfhsPromise = canApprove
		? db
				.select({
					id: wfhRequests.id,
					date: wfhRequests.date,
					userName: users.name,
					userAvatar: users.avatarUrl,
					createdAt: wfhRequests.createdAt,
				})
				.from(wfhRequests)
				.innerJoin(users, eq(wfhRequests.userId, users.id))
				.where(
					user.role === "admin"
						? eq(wfhRequests.status, "pending")
						: and(
								eq(wfhRequests.status, "pending"),
								eq(users.peerLeadId, user.id),
							),
				)
				.orderBy(desc(wfhRequests.createdAt))
				.limit(10)
		: Promise.resolve([]);

	const [
		personalStats,
		teamStats,
		existingLog,
		upcomingLeavesRes,
		leavesTodayRes,
		wfhTodayRes,
		allUsersWithBirthdays,
		recentLeaves,
		recentWfhs,
		pendingLeaves,
		pendingWfhs,
	] = await Promise.all([
		personalStatsPromise,
		teamStatsPromise,
		existingLogPromise,
		upcomingLeavesPromise,
		leavesTodayPromise,
		wfhTodayPromise,
		allUsersWithBirthdaysPromise,
		recentLeavesPromise,
		recentWfhsPromise,
		pendingLeavesPromise,
		pendingWfhsPromise,
	]);

	// Format team availability today
	const teamAvailability = [
		...leavesTodayRes.map((l) => ({
			name: l.userName,
			avatarUrl: l.userAvatar,
			statusText: `On Leave (${formatLeaveType(l.leaveType)})`,
		})),
		...wfhTodayRes.map((w) => ({
			name: w.userName,
			avatarUrl: w.userAvatar,
			statusText: "WFH",
		})),
	];

	// Format upcoming birthdays
	const todayDate = new Date();
	const upcomingBirthdays = allUsersWithBirthdays
		.map((u) => {
			if (!u.birthday) return null;
			const bd = new Date(`${u.birthday}T00:00:00`);
			const thisYear = new Date(
				todayDate.getFullYear(),
				bd.getMonth(),
				bd.getDate(),
			);
			if (thisYear < todayDate) {
				thisYear.setFullYear(thisYear.getFullYear() + 1);
			}
			const diffDays = Math.ceil(
				(thisYear.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
			);
			return {
				id: u.id,
				name: u.name,
				avatarUrl: u.avatarUrl,
				daysUntil: diffDays,
			};
		})
		.filter((u): u is NonNullable<typeof u> => u !== null && u.daysUntil <= 30)
		.sort((a, b) => a.daysUntil - b.daysUntil)
		.slice(0, 5);

	// Format recent requests
	const recentRequests = [
		...recentLeaves.map((l) => ({
			id: l.id,
			type: "leave",
			label: formatLeaveType(l.leaveType),
			date:
				l.startDate === l.endDate
					? formatDateDisplay(l.startDate)
					: `${formatDateDisplay(l.startDate)} – ${formatDateDisplay(l.endDate)}`,
			status: l.status,
			createdAt: l.createdAt ? l.createdAt.toISOString() : "",
		})),
		...recentWfhs.map((w) => ({
			id: w.id,
			type: "wfh",
			label: "WFH",
			date: formatDateDisplay(w.date),
			status: w.status,
			createdAt: w.createdAt ? w.createdAt.toISOString() : "",
		})),
	]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, 5);

	// Format pending approvals preview
	const pendingApprovals = [
		...pendingLeaves.map((l) => ({
			id: l.id,
			type: "leave" as const,
			name: l.userName,
			avatarUrl: l.userAvatar || undefined,
			label: `${formatLeaveType(l.leaveType)} (${l.totalDays}d)`,
			date:
				l.startDate === l.endDate
					? formatDateDisplay(l.startDate)
					: `${formatDateDisplay(l.startDate)} – ${formatDateDisplay(l.endDate)}`,
			createdAt: l.createdAt ? l.createdAt.toISOString() : "",
		})),
		...pendingWfhs.map((w) => ({
			id: w.id,
			type: "wfh" as const,
			name: w.userName,
			avatarUrl: w.userAvatar || undefined,
			label: "WFH",
			date: formatDateDisplay(w.date),
			createdAt: w.createdAt ? w.createdAt.toISOString() : "",
		})),
	]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, 8);

	// The previews above are capped, so count separately (same source as the sidebar badge).
	const totalPending = await getPendingApprovalCount(db, user);

	return {
		personalStats,
		teamStats,
		existingLog,
		upcomingLeaves: upcomingLeavesRes.map((l) => ({
			id: l.id,
			name: l.userName,
			avatarUrl: l.userAvatar,
			leaveType: l.leaveType,
			startDate: l.startDate,
			endDate: l.endDate,
			totalDays: l.totalDays,
		})),
		teamAvailability,
		upcomingBirthdays,
		recentRequests,
		pendingApprovals,
		totalPending,
	};
}
