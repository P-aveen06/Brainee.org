import { format, isToday, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";
import type { TaskDetailItem } from "./TaskDetailSheet";
import { TASK_STATUS_CONFIG, type TaskStatusKey } from "./taskStatusStyles";

interface TaskGanttRowProps {
	task: TaskDetailItem;
	taskIndex: number;
	projectCode: string;
	monthStartStr: string;
	monthEndStr: string;
	daysInMonth: Date[];
	onSelectTask: (task: TaskDetailItem) => void;
}

export function TaskGanttRow({
	task,
	taskIndex,
	projectCode,
	monthStartStr,
	monthEndStr,
	daysInMonth,
	onSelectTask,
}: TaskGanttRowProps) {
	const gridRow = taskIndex + 2;
	const taskStart = task.startDate || task.dueDate || monthStartStr;
	const taskEnd = task.dueDate || task.startDate || monthEndStr;

	// Clamp the bar to the month range (already filtered to overlaps)
	const effectiveStart = taskStart < monthStartStr ? monthStartStr : taskStart;
	const effectiveEnd = taskEnd > monthEndStr ? monthEndStr : taskEnd;

	const startDayIndex = daysInMonth.findIndex(
		(d) => format(d, "yyyy-MM-dd") === effectiveStart,
	);
	const endDayIndex = daysInMonth.findIndex(
		(d) => format(d, "yyyy-MM-dd") === effectiveEnd,
	);

	const startCol = startDayIndex >= 0 ? startDayIndex + 2 : 2; // +2 for 1-based index and skipping sticky label
	const safeEndCol =
		endDayIndex >= 0 ? endDayIndex + 2 : daysInMonth.length + 1;
	const spanDays = Math.max(1, safeEndCol - startCol + 1);

	const config =
		TASK_STATUS_CONFIG[task.status as TaskStatusKey] || TASK_STATUS_CONFIG.todo;

	return (
		<div key={task.id} className="contents group">
			{/* Frozen task label */}
			<button
				type="button"
				style={{ gridColumn: 1, gridRow }}
				className="sticky left-0 z-20 flex items-center justify-between gap-2 border-r border-t border-border bg-card p-2 shadow-[1px_0_0_var(--border)] transition-colors group-hover:bg-muted/50 cursor-pointer min-w-0 text-left font-normal"
				onClick={() => onSelectTask(task)}
			>
				<div className="min-w-0 flex items-center gap-1.5">
					<span className="font-mono text-[10px] font-semibold text-primary shrink-0">
						{projectCode} #{task.taskNumber}
					</span>
					<span className="truncate text-xs font-medium text-foreground">
						{task.title}
					</span>
				</div>
				<span className={cn("size-2 rounded-full shrink-0", config.dot)} />
			</button>

			{/* Month day grid cells as background */}
			{daysInMonth.map((day, dayIndex) => {
				const isDayToday = isToday(day);
				return (
					<div
						key={day.toISOString()}
						style={{ gridColumn: dayIndex + 2, gridRow }}
						className={cn(
							"border-t border-border bg-card transition-colors group-hover:bg-muted/30 relative",
							isWeekend(day) && "bg-muted/20",
							isDayToday && "bg-primary/5",
						)}
					/>
				);
			})}

			{/* Gantt bar */}
			<button
				type="button"
				style={{
					gridColumn: `${startCol} / span ${spanDays}`,
					gridRow,
				}}
				className={cn(
					"z-10 -mx-0.5 my-auto flex h-6 cursor-pointer items-center justify-between gap-1 truncate rounded-md border px-2 py-0.5 text-left text-[11px] font-medium shadow-xs transition-opacity hover:opacity-90",
					config.badge,
				)}
				onClick={() => onSelectTask(task)}
			>
				<span className="truncate text-foreground font-semibold">
					{task.title}
				</span>
				{task.estimateHours != null && (
					<span className="text-[9px] text-muted-foreground shrink-0 hidden sm:inline">
						{task.estimateHours}h
					</span>
				)}
			</button>
		</div>
	);
}
