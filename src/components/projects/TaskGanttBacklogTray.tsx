"use client";

import { Clock } from "lucide-react";
import type { TaskDetailItem } from "./TaskDetailSheet";
import { TaskPriorityBadge } from "./TaskPriorityBadge";

interface TaskGanttBacklogTrayProps {
	unscheduledTasks: TaskDetailItem[];
	onSelectTask: (task: TaskDetailItem) => void;
}

export function TaskGanttBacklogTray({
	unscheduledTasks,
	onSelectTask,
}: TaskGanttBacklogTrayProps) {
	if (unscheduledTasks.length === 0) return null;

	return (
		<div className="border border-border bg-card p-4 space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Clock className="size-4 text-amber-500" />
					<h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
						Unscheduled Backlog ({unscheduledTasks.length})
					</h4>
				</div>
				<p className="text-xs text-muted-foreground">
					These tasks lack start or due dates and do not appear on the timeline.
					Click to schedule.
				</p>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
				{unscheduledTasks.map((task) => (
					<button
						type="button"
						key={task.id}
						className="cursor-pointer border border-border bg-muted/20 p-2.5 hover:bg-muted/40 transition-colors flex items-center justify-between gap-2 text-left"
						onClick={() => onSelectTask(task)}
					>
						<div className="min-w-0 flex items-center gap-2">
							<span className="font-mono text-xs font-semibold text-primary">
								#{task.taskNumber}
							</span>
							<span className="text-xs font-medium text-foreground truncate">
								{task.title}
							</span>
						</div>
						<TaskPriorityBadge priority={task.priority} showLabel={false} />
					</button>
				))}
			</div>
		</div>
	);
}
