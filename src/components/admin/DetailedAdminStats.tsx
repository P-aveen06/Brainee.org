"use client";

import { Link } from "@tanstack/react-router";
import {
	AlertOctagon,
	ArrowRight,
	ArrowUpRight,
	Building2,
	CheckSquare,
	Clock,
	Laptop,
	Sparkles,
	TrendingUp,
	UserCheck,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PageTabs } from "@/components/ui/page-tabs";
import { StatCard, StatGroup } from "@/components/ui/stat-card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { DetailedAdminStatsData } from "../../lib/detailed-admin-stats.server";
import EmployeeStatsSelector from "./EmployeeStatsSelector";
import ProjectDeliverablesDonutChart from "./ProjectDeliverablesDonutChart";
import StatsFilterBar from "./StatsFilterBar";
import StatsTimelineChart from "./StatsTimelineChart";

interface DetailedAdminStatsProps {
	data: DetailedAdminStatsData;
}

type CeoTab = "capacity" | "talent" | "governance";

export default function DetailedAdminStats({ data }: DetailedAdminStatsProps) {
	const [activeTab, setActiveTab] = useState<CeoTab>(
		data.selectedUserId ? "talent" : "capacity",
	);

	// Aggregate hours by date for the timeline chart
	const hoursMap = new Map<string, number>();
	data.timesheets30Days.forEach((t) => {
		hoursMap.set(t.date, (hoursMap.get(t.date) || 0) + t.hours);
	});

	const chartData = Array.from(hoursMap.entries()).map(([date, hours]) => ({
		date,
		hours,
	}));

	const teamSize = data.employees.length || 1;
	const avgHoursPerTeammate = Math.round(
		data.summary.totalHoursWorked / teamSize,
	);

	return (
		<div className="space-y-6 mt-4">
			{/* 1. Executive Tabs - Placed ABOVE ALL with standard PageTabs underline indicator */}
			<div className="relative">
				<PageTabs
					value={activeTab}
					onChange={(val) => setActiveTab(val as CeoTab)}
					items={[
						{
							value: "capacity",
							label: (
								<span className="flex items-center gap-1.5">
									<TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
									Capacity & Workload
								</span>
							),
						},
						{
							value: "talent",
							label: (
								<span className="flex items-center gap-1.5">
									<UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
									Teammate Drill-Down
								</span>
							),
						},
						{
							value: "governance",
							label: (
								<span className="flex items-center gap-1.5">
									<AlertOctagon className="h-3.5 w-3.5" aria-hidden="true" />
									Escalations & Approvals
									{data.criticalBlockers.length +
										data.summary.pendingApprovals >
										0 && (
										<Badge
											variant="secondary"
											className="ml-1 px-1.5 py-0 text-[10px] font-mono"
										>
											{data.criticalBlockers.length +
												data.summary.pendingApprovals}
										</Badge>
									)}
								</span>
							),
						},
					]}
					ariaLabel="Executive Command Center sections"
				/>

				<div className="absolute right-0 top-1/2 -translate-y-1/2 hidden sm:block">
					<Button
						variant="outline"
						size="sm"
						render={<Link to="/assistant" />}
						nativeButton={false}
						className="h-7 text-xs gap-1.5 font-medium border-border"
					>
						<Sparkles className="size-3 text-accent" />
						Ask Brainee.org Brain
					</Button>
				</div>
			</div>

			{/* 2. TAB CONTENT */}

			{/* TAB 1: Capacity & Workload (Team Overview) */}
			{activeTab === "capacity" && (
				<div className="space-y-6">
					{/* Dedicated Date Range Filter Toolbar for Capacity */}
					<StatsFilterBar employees={data.employees} />

					{/* Capacity & Operational KPIs */}
					<StatGroup columns={4}>
						<StatCard
							label="Total Team Hours"
							value={data.summary.totalHoursWorked}
							suffix="hrs"
							icon={Clock}
							description={`Across ${teamSize} teammates`}
						/>
						<StatCard
							label="Average / Teammate"
							value={avgHoursPerTeammate}
							suffix="h / person"
							icon={Clock}
							description="Standard 160h monthly target"
						/>
						<StatCard
							label="In Office Today"
							value={data.todayPresence?.inOffice ?? teamSize}
							suffix="present"
							icon={Building2}
							description="On-site in facility"
						/>
						<StatCard
							label="WFH Today"
							value={data.todayPresence?.wfh ?? 0}
							suffix="on WFH"
							icon={Laptop}
							description={
								data.todayPresence?.wfhUsers?.length
									? data.todayPresence.wfhUsers.join(", ")
									: "None scheduled"
							}
						/>
					</StatGroup>

					{/* Charts Grid: Timeline Chart + Hours per Teammate Bar Chart */}
					<div className="grid gap-6 lg:grid-cols-2">
						{/* Chart 1: Timeline */}
						<Card className="border-border">
							<CardHeader className="p-4 border-b border-border">
								<div>
									<CardTitle className="text-sm font-semibold">
										Team Worked Hours Timeline
									</CardTitle>
									<CardDescription className="text-xs text-muted-foreground mt-0.5">
										Daily aggregate hours logged across active projects.
									</CardDescription>
								</div>
							</CardHeader>
							<CardContent className="p-4">
								{chartData.length === 0 ? (
									<div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
										No hours logged in the selected range.
									</div>
								) : (
									<StatsTimelineChart data={chartData} />
								)}
							</CardContent>
						</Card>

						{/* Chart 2: Client Deliverables & Project Bandwidth */}
						<Card className="border-border">
							<CardHeader className="p-4 border-b border-border">
								<div>
									<CardTitle className="text-sm font-semibold">
										Project Bandwidth & Deliverables
									</CardTitle>
									<CardDescription className="text-xs text-muted-foreground mt-0.5">
										Active sprint tasks distribution across client engagements.
									</CardDescription>
								</div>
							</CardHeader>
							<CardContent className="p-4">
								<ProjectDeliverablesDonutChart projects={data.projects} />
							</CardContent>
						</Card>
					</div>

					{/* Team Workload & Capacity Table */}
					<Card className="border-border">
						<CardHeader className="p-4 border-b border-border">
							<div>
								<CardTitle className="text-sm font-semibold">
									Team Workload & Capacity Utilization
								</CardTitle>
								<CardDescription className="text-xs text-muted-foreground mt-0.5">
									Logged hours vs. standard 160h monthly target per teammate.
								</CardDescription>
							</div>
						</CardHeader>
						<CardContent className="p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Teammate</TableHead>
										<TableHead>Role</TableHead>
										<TableHead>Hours Logged</TableHead>
										<TableHead>Daily Pace</TableHead>
										<TableHead>Active Deliverables</TableHead>
										<TableHead className="text-right">Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.employees.map((emp) => {
										const empSheets = data.timesheets30Days.filter(
											(t) => t.user_id === emp.id,
										);
										const totalHrs = empSheets.reduce(
											(sum, s) => sum + s.hours,
											0,
										);
										const dailyPace =
											empSheets.length > 0
												? (totalHrs / empSheets.length).toFixed(1)
												: "0";
										const empTasks = data.employeeTasks[emp.id] || [];
										const openTasks = empTasks.filter(
											(t) => t.status !== "done" && t.status !== "cancelled",
										);
										const blockedTasks = empTasks.filter(
											(t) => t.status === "blocked",
										);

										const isOptimal = totalHrs >= 140 && totalHrs <= 180;
										const isOvertime = totalHrs > 180;

										return (
											<TableRow key={emp.id}>
												<TableCell className="font-medium text-xs">
													{emp.name}
												</TableCell>
												<TableCell className="capitalize text-xs text-muted-foreground">
													{emp.role}
												</TableCell>
												<TableCell className="font-mono text-xs font-semibold">
													{totalHrs} hrs
												</TableCell>
												<TableCell className="font-mono text-xs text-muted-foreground">
													{dailyPace}h / day
												</TableCell>
												<TableCell className="text-xs">
													<span className="font-mono font-medium">
														{openTasks.length} open
													</span>
													{blockedTasks.length > 0 && (
														<span className="ml-1.5 text-amber-600 dark:text-amber-400 font-semibold font-mono text-[11px]">
															({blockedTasks.length} blocked)
														</span>
													)}
												</TableCell>
												<TableCell className="text-right">
													<Badge
														variant="outline"
														className={
															isOptimal
																? "border-emerald-500/30 text-emerald-700 bg-emerald-500/10 text-[11px]"
																: isOvertime
																	? "border-amber-500/30 text-amber-700 bg-amber-500/10 text-[11px]"
																	: "border-border text-muted-foreground text-[11px]"
														}
													>
														{isOptimal
															? "TARGET PACE"
															: isOvertime
																? "OVERTIME"
																: "LIGHT LOAD"}
													</Badge>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>
			)}

			{/* TAB 2: Teammate Drill-Down */}
			{activeTab === "talent" && (
				<EmployeeStatsSelector
					employees={data.employees}
					timesheets={data.timesheets30Days}
					balances={data.leaveBalances}
					requests={data.recentRequests}
					tasks={data.employeeTasks}
					initialSelectedId={data.selectedUserId}
				/>
			)}

			{/* TAB 3: Escalations & Approvals */}
			{activeTab === "governance" && (
				<div className="space-y-6">
					{/* Escalations & Governance KPIs */}
					<StatGroup columns={3}>
						<StatCard
							label="Active Delivery Blockers"
							value={data.criticalBlockers.length}
							icon={AlertOctagon}
							highlight={data.criticalBlockers.length > 0}
							description="Client & partner impediments"
						/>
						<StatCard
							label="Pending Approvals"
							value={data.summary.pendingApprovals}
							icon={CheckSquare}
							highlight={data.summary.pendingApprovals > 0}
							description="Leaves and WFH requests"
						/>
						<StatCard
							label="At-Risk Engagements"
							value={data.summary.atRiskProjectsCount}
							icon={AlertOctagon}
							description="Projects requiring mitigation"
						/>
					</StatGroup>

					{/* Critical Escalations */}
					{data.criticalBlockers.length > 0 ? (
						<Card className="border-amber-500/30 bg-amber-500/5 shadow-xs dark:border-amber-500/20 dark:bg-amber-950/10">
							<CardHeader className="p-4 pb-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
											<AlertOctagon className="size-4" />
										</div>
										<div>
											<CardTitle className="text-sm font-semibold text-foreground">
												Critical Delivery Escalations (
												{data.criticalBlockers.length})
											</CardTitle>
											<CardDescription className="text-xs text-muted-foreground">
												Client partner dependencies and rate-limiting issues
												blocking sprint milestones.
											</CardDescription>
										</div>
									</div>
									<Badge
										variant="outline"
										className="border-amber-500/30 text-amber-700 bg-amber-500/10 text-xs font-mono dark:text-amber-300"
									>
										Executive Action Required
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="p-4 pt-2">
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{data.criticalBlockers.slice(0, 6).map((blocker) => (
										<div
											key={blocker.id}
											className="flex flex-col justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40"
										>
											<div className="space-y-1.5">
												<div className="flex items-center justify-between text-xs">
													<span className="font-mono font-semibold text-foreground">
														[{blocker.projectCode}]
													</span>
													<span className="text-[11px] text-muted-foreground">
														{blocker.assigneeName || "Unassigned"}
													</span>
												</div>
												<h4 className="text-xs font-medium text-foreground line-clamp-2">
													{blocker.title}
												</h4>
												{blocker.blockedReason && (
													<p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400 line-clamp-3 bg-amber-500/10 p-2 rounded-md font-mono">
														{blocker.blockedReason}
													</p>
												)}
											</div>
											<div className="mt-3 flex items-center justify-between pt-2 border-t border-border/60 text-[11px]">
												<span className="text-muted-foreground">
													Due: {blocker.dueDate || "Immediate"}
												</span>
												<Link
													to="/projects/$id"
													params={{
														id: blocker.projectCode.toLowerCase(),
													}}
													className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
												>
													Inspect <ArrowUpRight className="size-3" />
												</Link>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					) : (
						<div className="rounded-lg border border-border bg-card p-6 text-center text-xs text-muted-foreground">
							Zero active delivery blockers. All sprints running on track!
						</div>
					)}

					{/* Fast-Action Approvals Queue */}
					<Card className="border-border">
						<CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
							<div>
								<CardTitle className="text-sm font-semibold">
									Pending Approvals Queue
								</CardTitle>
								<CardDescription className="text-xs text-muted-foreground mt-0.5">
									Leave and WFH requests requiring executive or lead signoff.
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								render={<Link to="/approvals" />}
								nativeButton={false}
								className="text-xs h-8 gap-1.5"
							>
								Open Full Approvals Queue <ArrowRight className="size-3.5" />
							</Button>
						</CardHeader>
						<CardContent className="p-4">
							{data.pendingApprovalsList.length === 0 ? (
								<div className="py-12 text-center text-xs text-muted-foreground space-y-1">
									<CheckSquare className="size-8 mx-auto text-emerald-500/60" />
									<div className="font-medium text-foreground">
										All Clear! No Pending Requests
									</div>
									<p>The executive approval queue is up to date.</p>
								</div>
							) : (
								<div className="grid gap-3 sm:grid-cols-2">
									{data.pendingApprovalsList.map((item) => (
										<div
											key={item.id}
											className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
										>
											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<span className="font-semibold text-xs text-foreground">
														{item.userName}
													</span>
													<Badge
														variant="outline"
														className="capitalize text-[11px] border-amber-500/30 text-amber-700 bg-amber-500/10 font-mono"
													>
														{item.type} · Pending
													</Badge>
												</div>
												<div className="text-xs text-muted-foreground font-mono">
													📅 {item.dates}
												</div>
												{item.reason && (
													<p className="text-xs text-foreground/80 bg-surface-alt/50 p-2 rounded-md">
														&ldquo;{item.reason}&rdquo;
													</p>
												)}
											</div>
											<div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-end gap-2">
												<Button
													size="sm"
													variant="outline"
													render={<Link to="/approvals" />}
													nativeButton={false}
													className="h-7 text-xs"
												>
													Review in Approvals
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
