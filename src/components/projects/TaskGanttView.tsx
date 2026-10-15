import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	format,
	isToday,
	isWeekend,
	startOfMonth,
	subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	DataTableContainer,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";
import { Button } from "@/components/ui/button";
import type { ProjectAccess } from "@/lib/project-access";
import { cn } from "@/lib/utils";
import { VIEW_PILLS } from "./ProjectHeaderSection";
import type { TaskDetailItem } from "./TaskDetailSheet";
import { TaskGanttBacklogTray } from "./TaskGanttBacklogTray";
import { TaskGanttRow } from "./TaskGanttRow";

interface TaskGanttViewProps {
	tasks: TaskDetailItem[];
	projectCode: string;
	onSelectTask: (task: TaskDetailItem) => void;
	view?: "list" | "board" | "gantt" | "calendar";
	onViewChange?: (view: "list" | "board" | "gantt" | "calendar") => void;
	onAddTask?: () => void;
	access?: ProjectAccess;
}

export function TaskGanttView({
	tasks,
	projectCode,
	onSelectTask,
	view = "gantt",
	onViewChange,
	onAddTask,
	access,
}: TaskGanttViewProps) {
	const [currentMonth, setCurrentMonth] = useState(() => new Date());
	const calendarScrollRef = useRef<HTMLDivElement>(null);

	const monthStart = startOfMonth(currentMonth);
	const monthEnd = endOfMonth(currentMonth);
	const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

	// Auto-scroll to today
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when month changes
	useEffect(() => {
		const timer = setTimeout(() => {
			const scrollContainer = calendarScrollRef.current;
			const todayElement = scrollContainer?.querySelector<HTMLElement>(
				"[data-today-column]",
			);
			if (scrollContainer && todayElement) {
				scrollContainer.scrollTo({
					left: Math.max(
						0,
						todayElement.offsetLeft -
							(scrollContainer.clientWidth - todayElement.clientWidth) / 2,
					),
					behavior: "smooth",
				});
			}
		}, 100);
		return () => clearTimeout(timer);
	}, [currentMonth]);

	// Filter tasks with dates vs unscheduled
	const { scheduledTasks, unscheduledTasks } = useMemo(() => {
		const scheduled: TaskDetailItem[] = [];
		const unscheduled: TaskDetailItem[] = [];

		for (const t of tasks) {
			if (t.startDate || t.dueDate) {
				scheduled.push(t);
			} else {
				unscheduled.push(t);
			}
		}

		return { scheduledTasks: scheduled, unscheduledTasks: unscheduled };
	}, [tasks]);

	const gridStyle = {
		display: "grid",
		gridTemplateColumns: `240px repeat(${daysInMonth.length}, minmax(36px, 1fr))`,
		gap: "1px",
		backgroundColor: "var(--border)",
		border: "1px solid var(--border)",
		minWidth: "max-content",
	};

	const monthStartStr = format(monthStart, "yyyy-MM-dd");
	const monthEndStr = format(monthEnd, "yyyy-MM-dd");

	// Only tasks that overlap the displayed month get a row. Without this, a task scheduled
	// in another month still renders its label and day cells with no bar — a blank row.
	const monthTasks = scheduledTasks.filter((t) => {
		const taskStart = t.startDate || t.dueDate || monthStartStr;
		const taskEnd = t.dueDate || t.startDate || monthEndStr;
		return taskStart <= monthEndStr && taskEnd >= monthStartStr;
	});

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
					<span className="hidden text-xs text-muted-foreground sm:inline-block ml-2">
						Scheduled:{" "}
						<strong className="text-foreground">{scheduledTasks.length}</strong>
					</span>
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
											(view || "gantt") === v.value
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

			{/* Gantt Matrix */}
			<DataTableContainer className="p-0 [&>div]:overflow-visible">
				<div ref={calendarScrollRef} className="max-w-full overflow-x-auto">
					<div style={gridStyle}>
						{/* Header frozen column */}
						<div className="sticky left-0 z-20 flex items-center border-r border-border bg-muted p-2.5 font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-[1px_0_0_var(--border)]">
							Task Work Item
						</div>

						{/* Day Header columns */}
						{daysInMonth.map((day) => {
							const isDayToday = isToday(day);
							return (
								<div
									key={day.toISOString()}
									data-today-column={isDayToday || undefined}
									className={cn(
										"bg-muted p-1.5 text-center flex flex-col justify-center text-[11px] relative",
										isWeekend(day) && "bg-muted/40",
										isDayToday && "bg-primary/10 border-x border-primary/30",
									)}
								>
									<span
										className={cn(
											"font-semibold",
											isDayToday ? "text-primary font-bold" : "text-foreground",
										)}
									>
										{format(day, "d")}
									</span>
									<span className="text-[9px] text-muted-foreground uppercase">
										{format(day, "EEEEE")}
									</span>
									{isDayToday && (
										<span className="absolute top-1 right-1 flex size-1.5 rounded-full bg-primary" />
									)}
								</div>
							);
						})}

						{/* Scheduled Task Rows */}
						{monthTasks.length === 0 ? (
							<div className="contents">
								<div className="col-span-full p-8 text-center text-xs text-muted-foreground bg-card">
									No tasks scheduled within or spanning{" "}
									{format(currentMonth, "MMMM yyyy")}.
								</div>
							</div>
						) : (
							monthTasks.map((task, taskIndex) => (
								<TaskGanttRow
									key={task.id}
									task={task}
									taskIndex={taskIndex}
									projectCode={projectCode}
									monthStartStr={monthStartStr}
									monthEndStr={monthEndStr}
									daysInMonth={daysInMonth}
									onSelectTask={onSelectTask}
								/>
							))
						)}
					</div>
				</div>
			</DataTableContainer>

			{/* Unscheduled Backlog Tray */}
			<TaskGanttBacklogTray
				unscheduledTasks={unscheduledTasks}
				onSelectTask={onSelectTask}
			/>
		</div>
	);
}
