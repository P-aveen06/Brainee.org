"use client";

import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	isSameMonth,
	isToday,
	isWeekend,
	startOfMonth,
	startOfWeek,
	subMonths,
} from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTableToolbar } from "@/components/layout/data-table-layout";
import { Button } from "@/components/ui/button";
import type { ProjectAccess } from "@/lib/project-access";
import { cn } from "@/lib/utils";
import { VIEW_PILLS } from "./ProjectHeaderSection";
import type { TaskDetailItem } from "./TaskDetailSheet";
import { TASK_STATUS_CONFIG, type TaskStatusKey } from "./taskStatusStyles";

interface TaskCalendarViewProps {
	tasks: TaskDetailItem[];
	projectCode: string;
	today: string;
	onSelectTask: (task: TaskDetailItem) => void;
	view?: "list" | "board" | "gantt" | "calendar";
	onViewChange?: (view: "list" | "board" | "gantt" | "calendar") => void;
	onAddTask?: () => void;
	access?: ProjectAccess;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function TaskCalendarView({
	tasks,
	projectCode: _projectCode,
	today,
	onSelectTask,
	view = "calendar",
	onViewChange,
	onAddTask,
	access,
}: TaskCalendarViewProps) {
	const [currentMonth, setCurrentMonth] = useState(() => new Date());

	const monthStart = startOfMonth(currentMonth);
	const monthEnd = endOfMonth(currentMonth);
	const calendarStart = startOfWeek(monthStart);
	const calendarEnd = endOfWeek(monthEnd);

	const calendarDays = eachDayOfInterval({
		start: calendarStart,
		end: calendarEnd,
	});

	// Index tasks by dueDate
	const tasksByDate = useMemo(() => {
		const map = new Map<string, TaskDetailItem[]>();
		for (const t of tasks) {
			if (t.dueDate) {
				const existing = map.get(t.dueDate) || [];
				existing.push(t);
				map.set(t.dueDate, existing);
			}
		}
		return map;
	}, [tasks]);

	return (
		<div className="space-y-4">
			{/* Standardized Toolbar */}
			<DataTableToolbar>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon-xs"
						onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
						className="size-8 rounded-full p-0"
						aria-label="Previous month"
					>
						<ChevronLeft className="size-4" />
					</Button>
					<span className="font-heading text-sm font-semibold min-w-[130px] text-center">
						{format(currentMonth, "MMMM yyyy")}
					</span>
					<Button
						variant="outline"
						size="icon-xs"
						onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
						className="size-8 rounded-full p-0"
						aria-label="Next month"
					>
						<ChevronRight className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="h-8 rounded-full px-3 text-xs"
						onClick={() => setCurrentMonth(new Date())}
					>
						Today
					</Button>
				</div>

				<div className="flex items-center gap-2.5">
					{onViewChange && (
						<div className="flex items-center rounded-lg bg-surface-alt p-0.5 border border-border/50">
							{VIEW_PILLS.map((v) => {
								const Icon = v.icon;
								return (
									<button
										key={v.value}
										type="button"
										onClick={() => onViewChange(v.value)}
										className={cn(
											"flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
											(view || "calendar") === v.value
												? "bg-card text-foreground shadow-xs font-semibold"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										<Icon className="size-3.5" />
										{v.label}
									</button>
								);
							})}
						</div>
					)}

					{access?.canContribute && onAddTask && (
						<Button
							size="sm"
							className="h-8 text-xs gap-1.5"
							onClick={onAddTask}
						>
							<Plus className="size-3.5" />
							New Task
						</Button>
					)}
				</div>
			</DataTableToolbar>

			{/* Calendar Grid - matched identically to MonthView */}
			<div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
				{/* Day of Week Headers */}
				<div className="grid grid-cols-7 gap-px bg-border">
					{WEEKDAYS.map((day) => (
						<div
							key={day}
							className="bg-card px-2 py-2.5 text-center font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
						>
							{day}
						</div>
					))}
				</div>

				{/* Days Matrix */}
				<div className="grid grid-cols-7 gap-px bg-border border-t border-border">
					{calendarDays.map((day) => {
						const dateStr = format(day, "yyyy-MM-dd");
						const dayTasks = tasksByDate.get(dateStr) || [];
						const isCurrentMonthDay = isSameMonth(day, currentMonth);
						const isDayToday = isToday(day);

						return (
							<div
								key={day.toISOString()}
								className={cn(
									"min-h-[100px] p-2 flex flex-col justify-between transition-colors",
									isWeekend(day) ? "bg-weekend" : "bg-card",
									!isCurrentMonthDay && "text-muted-foreground opacity-40",
									isDayToday && "ring-1 ring-inset ring-primary/40",
								)}
							>
								{/* Day Number Header */}
								<div className="flex items-center justify-between pb-1">
									<span
										className={cn(
											"flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
											isDayToday
												? "bg-primary text-primary-foreground font-semibold"
												: "text-foreground",
										)}
									>
										{format(day, "d")}
									</span>

									{dayTasks.length > 0 && (
										<span className="text-[10px] font-medium text-muted-foreground">
											{dayTasks.length}{" "}
											{dayTasks.length === 1 ? "task" : "tasks"}
										</span>
									)}
								</div>

								{/* Tasks on this day */}
								<div className="space-y-1 overflow-y-auto max-h-[85px] pt-1">
									{dayTasks.slice(0, 3).map((task) => {
										const config =
											TASK_STATUS_CONFIG[task.status as TaskStatusKey] ||
											TASK_STATUS_CONFIG.todo;
										const isOverdue =
											task.status !== "done" &&
											task.status !== "cancelled" &&
											task.dueDate &&
											task.dueDate < today;

										return (
											<button
												type="button"
												key={task.id}
												className="w-full text-left group cursor-pointer rounded border border-border bg-card px-1.5 py-0.5 text-[11px] hover:border-primary/50 transition-all flex items-center gap-1.5 shadow-2xs font-normal"
												onClick={() => onSelectTask(task)}
											>
												<span
													className={cn(
														"size-1.5 rounded-full shrink-0",
														config.dot,
													)}
												/>
												<span className="font-mono text-[10px] font-semibold text-primary shrink-0">
													#{task.taskNumber}
												</span>
												<span className="truncate text-foreground font-medium flex-1">
													{task.title}
												</span>
												{isOverdue && (
													<AlertTriangle className="size-3 text-destructive shrink-0" />
												)}
											</button>
										);
									})}

									{dayTasks.length > 3 && (
										<p className="text-[10px] text-muted-foreground text-center pt-0.5">
											+{dayTasks.length - 3} more
										</p>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
