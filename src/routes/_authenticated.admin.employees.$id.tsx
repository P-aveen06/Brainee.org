import { env } from "cloudflare:workers";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import {
	Calendar,
	CalendarDays,
	ChevronLeft,
	Clock,
	History,
	Mail,
	User,
} from "lucide-react";
import { z } from "zod";
import { StatusBadge } from "../components/admin/StatusBadge";
import { EmployeeEquipmentSection } from "../components/assets/EmployeeEquipmentSection";
import { Page, PageHeader } from "../components/layout/page-layout";
import { Badge } from "../components/ui/badge";
import { buttonVariants } from "../components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../components/ui/card";
import { createDb } from "../db";
import {
	leaveBalances,
	leaveRequests,
	systemLeaveTypes,
	timesheets,
	users,
} from "../db/schema";
import { formatDateDisplay } from "../lib/date-format";
import { ensureBalancesForCycle } from "../lib/leave-balances.server";
import { formatLeaveType } from "../lib/leave-policy";
import { adminMiddleware } from "../lib/server-fn";

export const getEmployeePageData = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => z.string().parse(data))
	.handler(async ({ data: id }) => {
		const db = createDb(env.DATABASE);

		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, id))
			.limit(1);

		if (!user) return null;

		let role = user.role;
		if (role === "user") {
			const [reports] = await db
				.select({ count: count() })
				.from(users)
				.where(eq(users.peerLeadId, id));

			if (reports && reports.count > 0) {
				role = "lead";
			}
		}

		const cycle = user.birthday
			? await ensureBalancesForCycle(db, {
					id,
					birthday: user.birthday,
					joinDate: user.joinDate,
				})
			: null;

		const dbBalances = cycle
			? await db
					.select()
					.from(leaveBalances)
					.where(
						and(
							eq(leaveBalances.userId, id),
							eq(leaveBalances.cycleStart, cycle.cycleStart),
						),
					)
			: [];

		const dbLeaveTypes = await db
			.select({ slug: systemLeaveTypes.slug, name: systemLeaveTypes.name })
			.from(systemLeaveTypes);

		const leaveTypeNames = dbLeaveTypes.reduce(
			(acc: Record<string, string>, type: { slug: string; name: string }) => {
				acc[type.slug] = type.name;
				return acc;
			},
			{},
		);

		type BalanceResult = {
			id: string;
			leave_type: string;
			total_limit: number;
			used: number;
			cycle_start: string;
			cycle_end: string;
			system_leave_types: {
				name: string;
			};
		};

		const latestBalances = dbBalances.reduce(
			(acc: Record<string, BalanceResult>, curr) => {
				if (
					!acc[curr.leaveType] ||
					new Date(curr.cycleEnd) > new Date(acc[curr.leaveType].cycle_end)
				) {
					acc[curr.leaveType] = {
						id: curr.id,
						leave_type: curr.leaveType,
						total_limit: Number(curr.totalLimit),
						used: Number(curr.used),
						cycle_start: curr.cycleStart,
						cycle_end: curr.cycleEnd,
						system_leave_types: {
							name: leaveTypeNames[curr.leaveType] || curr.leaveType,
						},
					};
				}
				return acc;
			},
			{} as Record<string, BalanceResult>,
		);

		const currentYearBalances = Object.values(latestBalances);

		// Recent leave history
		const dbLeaveHistory = await db
			.select({
				id: leaveRequests.id,
				leaveType: leaveRequests.leaveType,
				startDate: leaveRequests.startDate,
				endDate: leaveRequests.endDate,
				totalDays: leaveRequests.totalDays,
				status: leaveRequests.status,
			})
			.from(leaveRequests)
			.where(eq(leaveRequests.userId, id))
			.orderBy(desc(leaveRequests.startDate))
			.limit(10);

		const leaveHistory = dbLeaveHistory.map((l) => ({
			id: l.id,
			leave_type: l.leaveType,
			start_date: l.startDate,
			end_date: l.endDate,
			total_days: Number(l.totalDays),
			status: l.status,
		}));

		// Hours logged: this-month summary + recent entries
		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
			.toISOString()
			.slice(0, 10);
		const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
			.toISOString()
			.slice(0, 10);

		const monthTimesheets = await db
			.select({ date: timesheets.date, hours: timesheets.hours })
			.from(timesheets)
			.where(
				and(
					eq(timesheets.userId, id),
					gte(timesheets.date, monthStart),
					lte(timesheets.date, monthEnd),
				),
			);

		const hoursThisMonth = monthTimesheets.reduce(
			(sum, t) => sum + Number(t.hours),
			0,
		);
		const daysWorkedThisMonth = new Set(monthTimesheets.map((t) => t.date))
			.size;

		const dbRecentTimesheets = await db
			.select({
				id: timesheets.id,
				date: timesheets.date,
				hours: timesheets.hours,
				status: timesheets.status,
			})
			.from(timesheets)
			.where(eq(timesheets.userId, id))
			.orderBy(desc(timesheets.date))
			.limit(10);

		const recentTimesheets = dbRecentTimesheets.map((t) => ({
			id: t.id,
			date: t.date,
			hours: Number(t.hours),
			status: t.status,
		}));

		return {
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				role,
				standard_hours: Number(user.standardHours),
				join_date: user.joinDate,
				birthday: user.birthday,
				created_at: user.createdAt ? user.createdAt.toISOString() : "",
			},
			currentYearBalances,
			leaveHistory,
			hoursThisMonth,
			daysWorkedThisMonth,
			recentTimesheets,
		};
	});

export const Route = createFileRoute("/_authenticated/admin/employees/$id")({
	loader: async ({ params }) => {
		const data = await getEmployeePageData({ data: params.id });
		if (!data) throw notFound();
		return { data };
	},
	component: EmployeePage,
});

function EmployeePage() {
	const { data } = Route.useLoaderData();
	const {
		user,
		currentYearBalances,
		leaveHistory,
		hoursThisMonth,
		daysWorkedThisMonth,
		recentTimesheets,
	} = data;

	return (
		<Page>
			<PageHeader
				leading={
					<Link
						to="/admin"
						className={`${buttonVariants({ variant: "ghost", size: "icon" })} rounded-full animate-in fade-in`}
					>
						<ChevronLeft className="h-4 w-4" />
					</Link>
				}
				title={
					<>
						{user.name}
						<Badge
							variant={user.role === "admin" ? "default" : "secondary"}
							className="capitalize animate-in zoom-in-95"
						>
							{user.role}
						</Badge>
					</>
				}
				description={
					<span className="flex items-center gap-2">
						<Mail className="h-4 w-4 text-muted-foreground" /> {user.email}
					</span>
				}
			/>

			<div className="grid gap-6 md:grid-cols-2">
				<Card className="border-border/50 bg-card/50">
					<CardHeader>
						<CardTitle className="text-sm font-semibold">
							Employee Details
						</CardTitle>
						<CardDescription>System and profile settings</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex justify-between items-center py-2 border-b border-border/50">
							<span className="text-muted-foreground text-sm flex items-center gap-2">
								<Clock className="h-4 w-4" /> Standard Hours
							</span>
							<span className="font-medium text-sm">
								{user.standard_hours} hrs/day
							</span>
						</div>
						<div className="flex justify-between items-center py-2 border-b border-border/50">
							<span className="text-muted-foreground text-sm flex items-center gap-2">
								<CalendarDays className="h-4 w-4" /> Join Date
							</span>
							<span className="font-medium text-sm">
								{user.join_date
									? formatDateDisplay(new Date(user.join_date))
									: "Not set"}
							</span>
						</div>
						<div className="flex justify-between items-center py-2 border-b border-border/50">
							<span className="text-muted-foreground text-sm flex items-center gap-2">
								<User className="h-4 w-4" /> Birthday
							</span>
							<span className="font-medium text-sm">
								{user.birthday
									? formatDateDisplay(new Date(user.birthday))
									: "Not set"}
							</span>
						</div>
						<div className="flex justify-between items-center py-2">
							<span className="text-muted-foreground text-sm flex items-center gap-2">
								<History className="h-4 w-4" /> Account Created
							</span>
							<span className="font-medium text-sm">
								{formatDateDisplay(new Date(user.created_at))}
							</span>
						</div>
					</CardContent>
				</Card>

				<Card className="border-border/50 bg-card/50">
					<CardHeader>
						<CardTitle className="text-sm font-semibold">
							Current Leave Cycle
						</CardTitle>
						<CardDescription>Available balances and usage</CardDescription>
					</CardHeader>
					<CardContent>
						{currentYearBalances.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed text-sm">
								No active leave cycles found.
							</div>
						) : (
							<div className="space-y-4">
								{currentYearBalances.map((balance) => (
									<div key={balance.id} className="space-y-2">
										<div className="flex justify-between items-center text-sm">
											<span className="font-medium capitalize flex items-center gap-2">
												<Calendar className="h-4 w-4 text-muted-foreground" />
												{balance.system_leave_types?.name || balance.leave_type}
											</span>
											<span className="text-xs text-muted-foreground">
												{balance.total_limit - balance.used} /{" "}
												{balance.total_limit} days left
											</span>
										</div>
										<div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
											<div
												className="h-full bg-accent transition-all"
												style={{
													width: `${Math.min(100, (balance.used / balance.total_limit) * 100)}%`,
												}}
											/>
										</div>
										{balance.cycle_start && balance.cycle_end && (
											<p className="text-[10px] text-muted-foreground text-right">
												Resets {formatDateDisplay(new Date(balance.cycle_end))}
											</p>
										)}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				{/* Leave History */}
				<Card className="border-border/50 bg-card/50">
					<CardHeader>
						<CardTitle className="text-sm font-semibold">
							Leave History
						</CardTitle>
						<CardDescription>Recent leave requests</CardDescription>
					</CardHeader>
					<CardContent>
						{leaveHistory.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed text-sm">
								No leave requests yet.
							</div>
						) : (
							<div className="divide-y divide-border/50">
								{leaveHistory.map((leave) => (
									<div
										key={leave.id}
										className="flex items-center justify-between gap-3 py-2.5"
									>
										<div className="min-w-0 space-y-0.5">
											<p className="text-sm font-medium truncate">
												{formatLeaveType(leave.leave_type)}
												<span className="ml-1 text-xs text-muted-foreground">
													({leave.total_days}d)
												</span>
											</p>
											<p className="text-xs text-muted-foreground">
												{formatDateDisplay(new Date(leave.start_date))}
												{leave.end_date !== leave.start_date
													? ` → ${formatDateDisplay(new Date(leave.end_date))}`
													: ""}
											</p>
										</div>
										<StatusBadge status={leave.status} />
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Timesheets */}
				<Card className="border-border/50 bg-card/50">
					<CardHeader>
						<CardTitle className="text-sm font-semibold">
							Hours Logged
						</CardTitle>
						<CardDescription>
							{hoursThisMonth} hrs · {daysWorkedThisMonth} days worked this
							month
						</CardDescription>
					</CardHeader>
					<CardContent>
						{recentTimesheets.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed text-sm">
								No timesheets logged yet.
							</div>
						) : (
							<div className="divide-y divide-border/50">
								{recentTimesheets.map((entry) => (
									<div
										key={entry.id}
										className="flex items-center justify-between gap-3 py-2.5"
									>
										<p className="text-sm text-muted-foreground flex items-center gap-2">
											<Clock className="h-3.5 w-3.5" />
											{formatDateDisplay(new Date(entry.date))}
										</p>
										<div className="flex items-center gap-2">
											{entry.status === "re_entry" && (
												<Badge
													variant="outline"
													className="text-[10px] border-status-reentry-foreground/40 text-status-reentry-foreground"
												>
													Needs correction
												</Badge>
											)}
											<span className="text-sm font-medium tabular-nums">
												{entry.hours} hrs
											</span>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Assigned Equipment & Client Deployments */}
			<div className="pt-2">
				<EmployeeEquipmentSection userId={user.id} isAdmin={true} />
			</div>
		</Page>
	);
}
