"use client";

import { AlertCircle, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateDisplay } from "@/lib/date-format";
import type { ProjectAccess } from "@/lib/project-access";
import { cn } from "@/lib/utils";
import type { TaskDetailItem } from "./TaskDetailSheet";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import type { TaskStatusKey } from "./taskStatusStyles";

interface TaskBoardCardProps {
	task: TaskDetailItem;
	projectCode: string;
	access: ProjectAccess;
	today: string;
	boardColumns: { key: TaskStatusKey; title: string }[];
	isPending: boolean;
	onSelectTask: (task: TaskDetailItem) => void;
	onMoveStatus: (task: TaskDetailItem, targetStatus: TaskStatusKey) => void;
}

export function TaskBoardCard({
	task,
	projectCode,
	access,
	today,
	boardColumns,
	isPending,
	onSelectTask,
	onMoveStatus,
}: TaskBoardCardProps) {
	const isOverdue =
		task.status !== "done" &&
		task.status !== "cancelled" &&
		task.dueDate &&
		task.dueDate < today;

	return (
		// biome-ignore lint/a11y/useSemanticElements: card contains nested interactive dropdown trigger
		<div
			role="button"
			tabIndex={0}
			className="cursor-pointer border border-border bg-card p-3 shadow-2xs hover:border-primary/50 transition-all space-y-2.5"
			onClick={() => onSelectTask(task)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelectTask(task);
				}
			}}
		>
			<div className="flex items-start justify-between gap-2">
				<span className="font-mono text-[11px] font-semibold text-primary">
					{projectCode} #{task.taskNumber}
				</span>

				<div className="flex items-center gap-1.5">
					<TaskPriorityBadge priority={task.priority} showLabel={false} />

					{access.canContribute && (
						<DropdownMenu>
							<DropdownMenuTrigger
								onClick={(e) => e.stopPropagation()}
								render={
									<Button
										variant="ghost"
										size="icon-xs"
										className="size-5 p-0 -mr-1"
									/>
								}
							>
								<MoreVertical className="size-3.5 text-muted-foreground" />
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								onClick={(e) => e.stopPropagation()}
							>
								<DropdownMenuLabel className="text-xs font-semibold">
									Move to...
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{boardColumns.map((target) => (
									<DropdownMenuItem
										key={target.key}
										disabled={target.key === task.status || isPending}
										onClick={() => onMoveStatus(task, target.key)}
									>
										{target.title}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</div>

			{/* Title */}
			<p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
				{task.title}
			</p>

			{/* Blocked reason banner on card */}
			{task.status === "blocked" && task.blockedReason && (
				<div className="border border-destructive/30 bg-destructive/10 p-1.5 text-[10px] text-destructive flex items-start gap-1">
					<AlertCircle className="size-3 shrink-0 mt-0.5" />
					<span className="line-clamp-2">{task.blockedReason}</span>
				</div>
			)}

			{/* Footer metadata */}
			<div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
				<div className="flex items-center gap-1.5 text-muted-foreground">
					{task.dueDate ? (
						<span className={cn(isOverdue && "text-destructive font-semibold")}>
							{formatDateDisplay(task.dueDate)}
						</span>
					) : (
						<span className="text-[10px] text-muted-foreground/60 italic">
							No date
						</span>
					)}
				</div>

				{(task.assigneeName || task.assignee?.name) && (
					<div className="flex items-center gap-1">
						<Avatar className="size-4">
							<AvatarImage
								src={
									task.assigneeAvatarUrl ||
									task.assignee?.avatarUrl ||
									undefined
								}
							/>
							<AvatarFallback className="text-[8px] bg-muted font-medium">
								{(task.assigneeName || task.assignee?.name)?.[0] || "?"}
							</AvatarFallback>
						</Avatar>
						<span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
							{task.assigneeName || task.assignee?.name}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
