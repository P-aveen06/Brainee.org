"use client";

import {
	AlertOctagon,
	ArrowLeft,
	CalendarOff,
	Clock,
	FolderKanban,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, StatGroup } from "@/components/ui/stat-card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/date-format";
import type { EmployeeAssignedTask } from "@/lib/detailed-admin-stats.server";
import { getInitials } from "@/lib/utils";
import type {
	Employee,
	LeaveBalance,
	Request,
	TimesheetData,
} from "./employee-detail-stats.types";
import { RoleBadge } from "./RoleBadge";
import { StatusBadge } from "./StatusBadge";

interface EmployeeDetailStatsProps {
	employee: Employee;
	timesheets: TimesheetData[];
	balances: LeaveBalance[];
	requests: Request[];
	tasks?: EmployeeAssignedTask[];
	onBack?: () => void;
}

export default function EmployeeDetailStats({
	employee,
	timesheets,
	balances,
	requests,
	tasks = [],
	onBack,
}: EmployeeDetailStatsProps) {
	const totalHours = timesheets.reduce((sum, s) => sum + s.hours, 0);
	const averageHours =
		timesheets.length > 0 ? (totalHours / timesheets.length).toFixed(1) : "0";

	const openTasks = tasks.filter(
		(t) => t.status !== "done" && t.status !== "cancelled",
	);
	const completedTasks = tasks.filter((t) => t.status === "done");
	const blockedTasks = tasks.filter((t) => t.status === "blocked");

	const totalUsedLeaves = balances.reduce((sum, b) => sum + b.used, 0);
	const totalLimit = balances.reduce((sum, b) => sum + b.total_limit, 0);
	const totalRemainingLeaves = Math.max(0, totalLimit - totalUsedLeaves);

	const leaveBreakdownInfo = (
		<div className="space-y-2 p-1 text-xs">
			<div className="font-semibold text-foreground border-b border-border pb-1">
				Leave Allowances Breakdown
			</div>
			{balances.map((b) => (
				<div
					key={b.leave_type}
					className="flex justify-between items-center gap-3 text-xs"
				>
					<span className="capitalize text-muted-foreground">
						{b.leave_type.replace("_", " ")}
					</span>
					<span className="font-mono font-medium">
						{b.total_limit - b.used}d left ({b.used}/{b.total_limit}d)
					</span>
				</div>
			))}
		</div>
	);

	return (
		<div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Clean Single Title Line with Name, Role, Email, and Quick Switcher */}
			<div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border">
				<div className="flex items-center gap-2.5">
					{onBack && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onBack}
							className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground -ml-1 gap-1"
						>
							<ArrowLeft className="size-3.5" />
							All
						</Button>
					)}
					{onBack && <div className="h-4 w-px bg-border" />}
					<Avatar className="size-8 rounded-lg shrink-0">
						<AvatarImage src={employee.avatar_url || undefined} />
						<AvatarFallback className="rounded-lg bg-secondary text-xs font-semibold">
							{getInitials(employee.name)}
						</AvatarFallback>
					</Avatar>
					<div className="flex items-center gap-2">
						<h3 className="font-heading font-semibold text-sm text-foreground">
							{employee.name}
						</h3>
						<RoleBadge role={employee.role} />
						<span className="text-xs text-muted-foreground font-mono">
							({employee.email})
						</span>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{blockedTasks.length > 0 && (
						<Badge
							variant="outline"
							className="border-amber-500/30 text-amber-700 bg-amber-500/10 font-mono text-xs"
						>
							⚠️ {blockedTasks.length} Blocked
						</Badge>
					)}
				</div>
			</div>

			{/* Teammate 5-Metric StatGroup (Using the EXISTING StatCard design!) */}
			<StatGroup columns={5}>
				<StatCard
					label="Logged Hours"
					value={totalHours}
					suffix="hrs"
					icon={Clock}
					description={`${timesheets.length} days logged`}
				/>
				<StatCard
					label="Daily Average"
					value={averageHours}
					suffix="h / day"
					icon={Clock}
					description="Standard 8h target"
				/>
				<StatCard
					label="Sprint Tasks"
					value={openTasks.length}
					suffix="open"
					icon={FolderKanban}
					description={`${completedTasks.length} completed`}
				/>
				<StatCard
					label="Leave Balances"
					value={totalRemainingLeaves}
					suffix="days left"
					icon={CalendarOff}
					info={leaveBreakdownInfo}
					description={`${totalUsedLeaves} of ${totalLimit} days used`}
				/>
				<StatCard
					label="Blockers"
					value={blockedTasks.length}
					suffix={blockedTasks.length === 1 ? "blocker" : "blockers"}
					icon={AlertOctagon}
					highlight={blockedTasks.length > 0}
					description={
						blockedTasks.length > 0
							? "Requires unblocking"
							: "Zero active impediments"
					}
				/>
			</StatGroup>

			{/* Active Assigned Tasks Section */}
			{tasks.length > 0 && (
				<Card className="border-border">
					<CardHeader className="p-4 border-b border-border">
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-sm font-semibold">
									Current Sprint Deliverables & Task Ownership ({tasks.length})
								</CardTitle>
								<p className="text-xs text-muted-foreground mt-0.5">
									Deliverables assigned to {employee.name} across active
									projects.
								</p>
							</div>
						</div>
					</CardHeader>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[100px]">Project</TableHead>
									<TableHead>Deliverable</TableHead>
									<TableHead>Due Date</TableHead>
									<TableHead className="text-right">Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{tasks.map((task) => (
									<TableRow key={task.id}>
										<TableCell className="font-mono text-xs font-semibold">
											[{task.projectCode}]
										</TableCell>
										<TableCell>
											<div className="space-y-1">
												<div className="font-medium text-xs text-foreground">
													#{task.taskNumber} {task.title}
												</div>
												{task.blockedReason && (
													<p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 p-1.5 rounded-md font-mono">
														⚠️ Blocked: {task.blockedReason}
													</p>
												)}
											</div>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground font-mono">
											{task.dueDate || "Ongoing"}
										</TableCell>
										<TableCell className="text-right">
											<Badge
												variant="outline"
												className={
													task.status === "done"
														? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-[11px]"
														: task.status === "blocked"
															? "border-amber-500/30 text-amber-600 bg-amber-500/10 text-[11px]"
															: "border-border text-foreground text-[11px]"
												}
											>
												{task.status.replace("_", " ").toUpperCase()}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{/* Recent Activity Card */}
			<Card className="border-border">
				<CardHeader className="p-4 border-b border-border">
					<CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{requests.length === 0 ? (
						<p className="text-xs text-muted-foreground text-center py-10">
							No recent requests.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Type</TableHead>
									<TableHead>Dates</TableHead>
									<TableHead className="text-right">Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{requests.map((req) => (
									<TableRow key={req.id}>
										<TableCell className="capitalize font-medium text-xs">
											{req.type}
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{formatDateDisplay(req.start_date)}
											{req.start_date !== req.end_date &&
												` - ${formatDateDisplay(req.end_date)}`}
										</TableCell>
										<TableCell className="text-right">
											<StatusBadge status={req.status} />
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
