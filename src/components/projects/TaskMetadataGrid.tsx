"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateDisplay } from "@/lib/date-format";
import type { TaskDetailItem } from "./TaskDetailSheet";

interface TaskMetadataGridProps {
	task: TaskDetailItem;
}

export function TaskMetadataGrid({ task }: TaskMetadataGridProps) {
	return (
		<div className="grid grid-cols-2 gap-5 rounded-xl bg-surface p-4 text-xs">
			<div>
				<span className="text-muted-foreground block">Assignee</span>
				{task.assigneeName ? (
					<div className="flex items-center gap-2 mt-1">
						<Avatar className="size-6">
							<AvatarImage src={task.assigneeAvatarUrl || undefined} />
							<AvatarFallback className="text-[10px]">
								{task.assigneeName.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span className="font-medium text-foreground truncate">
							{task.assigneeName}
						</span>
					</div>
				) : (
					<span className="text-muted-foreground font-medium mt-1 block">
						Unassigned
					</span>
				)}
			</div>

			<div>
				<span className="text-muted-foreground block">Timeline</span>
				<div className="mt-1 space-y-0.5 text-foreground">
					<p>
						Start:{" "}
						<span className="font-medium">
							{task.startDate ? formatDateDisplay(task.startDate) : "—"}
						</span>
					</p>
					<p>
						Due:{" "}
						<span className="font-medium">
							{task.dueDate ? formatDateDisplay(task.dueDate) : "—"}
						</span>
					</p>
				</div>
			</div>

			<div>
				<span className="text-muted-foreground block">Hours Budget</span>
				<p className="mt-1 text-foreground font-medium">
					{task.estimateHours != null
						? `${task.estimateHours} hrs est.`
						: "No estimate"}
					{task.actualHours != null && ` • ${task.actualHours} hrs actual`}
				</p>
			</div>

			<div>
				<span className="text-muted-foreground block">Created / Completed</span>
				<p className="mt-1 text-muted-foreground">
					{task.createdAt ? formatDateDisplay(task.createdAt) : "—"}
					{task.completedAt &&
						` (Done: ${formatDateDisplay(task.completedAt)})`}
				</p>
			</div>
		</div>
	);
}
