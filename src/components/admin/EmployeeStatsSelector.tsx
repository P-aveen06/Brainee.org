"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { EmployeeAssignedTask } from "@/lib/detailed-admin-stats.server";
import { getInitials } from "@/lib/utils";
import EmployeeDetailStats from "./EmployeeDetailStats";
import { RoleBadge } from "./RoleBadge";

interface Employee {
	id: string;
	name: string;
	email: string;
	avatar_url: string | null;
	role: string;
}

interface TimesheetData {
	date: string;
	hours: number;
	user_id: string;
}

interface LeaveBalance {
	user_id: string;
	leave_type: string;
	total_limit: number;
	used: number;
}

interface Request {
	id: string;
	user_id: string;
	type: "leave" | "wfh";
	status: string;
	start_date: string;
	end_date: string;
	reason: string | null;
}

interface EmployeeStatsSelectorProps {
	employees: Employee[];
	timesheets: TimesheetData[];
	balances: LeaveBalance[];
	requests: Request[];
	tasks?: Record<string, EmployeeAssignedTask[]>;
	initialSelectedId?: string;
}

export default function EmployeeStatsSelector({
	employees,
	timesheets,
	balances,
	requests,
	tasks = {},
	initialSelectedId,
}: EmployeeStatsSelectorProps) {
	const [selectedId, setSelectedId] = useState<string>(initialSelectedId || "");

	const activeEmployee = employees.find((e) => e.id === selectedId);

	const employeeSheets = timesheets.filter((t) => t.user_id === selectedId);
	const employeeBalances = balances.filter((b) => b.user_id === selectedId);
	const employeeRequests = requests
		.filter((r) => r.user_id === selectedId)
		.slice(0, 5);
	const employeeAssignedTasks = tasks[selectedId] || [];

	return (
		<div className="space-y-4">
			{activeEmployee ? (
				<EmployeeDetailStats
					employee={activeEmployee}
					timesheets={employeeSheets}
					balances={employeeBalances}
					requests={employeeRequests}
					tasks={employeeAssignedTasks}
					onBack={() => setSelectedId("")}
				/>
			) : (
				<div className="space-y-4">
					<div className="flex items-center justify-between gap-4 py-1">
						<h3 className="font-heading font-semibold text-sm text-foreground">
							Teammate Directory ({employees.length})
						</h3>
						<div className="w-[200px]">
							<Select
								value={selectedId}
								onValueChange={(val) => setSelectedId(val || "")}
							>
								<SelectTrigger className="w-full h-8 text-xs">
									<SelectValue placeholder="Choose a teammate..." />
								</SelectTrigger>
								<SelectContent>
									{employees.map((emp) => (
										<SelectItem key={emp.id} value={emp.id}>
											{emp.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Directory Quick Grid with standard styling */}
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{employees.map((emp) => {
							const empSheets = timesheets.filter((t) => t.user_id === emp.id);
							const totalHrs = empSheets.reduce((sum, s) => sum + s.hours, 0);
							const empTasks = tasks[emp.id] || [];
							const openCount = empTasks.filter(
								(t) => t.status !== "done" && t.status !== "cancelled",
							).length;
							const blockerCount = empTasks.filter(
								(t) => t.status === "blocked",
							).length;

							return (
								<button
									key={emp.id}
									type="button"
									onClick={() => setSelectedId(emp.id)}
									className="flex flex-col justify-between rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								>
									<div className="flex items-center gap-3">
										<Avatar className="size-9 rounded-lg shrink-0">
											<AvatarImage src={emp.avatar_url || undefined} />
											<AvatarFallback className="rounded-lg bg-secondary text-xs">
												{getInitials(emp.name)}
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-1.5">
												<span className="font-semibold text-xs text-foreground truncate">
													{emp.name}
												</span>
												<RoleBadge role={emp.role} />
											</div>
											<p className="text-[11px] text-muted-foreground truncate font-mono">
												{emp.email}
											</p>
										</div>
									</div>

									<div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
										<span className="font-mono font-medium text-foreground">
											{totalHrs}h logged
										</span>
										<div className="flex items-center gap-1.5">
											<span className="text-muted-foreground font-mono">
												{openCount} tasks
											</span>
											{blockerCount > 0 && (
												<Badge
													variant="outline"
													className="border-amber-500/30 text-amber-700 bg-amber-500/10 text-[10px] px-1 py-0"
												>
													⚠️ {blockerCount} blocked
												</Badge>
											)}
										</div>
									</div>
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
