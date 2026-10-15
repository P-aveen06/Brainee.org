"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
	DataTableContainer,
	DataTableFilters,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/date-format";
import type { ProjectAccess } from "@/lib/project-access";
import { cn } from "@/lib/utils";
import { VIEW_PILLS } from "./ProjectHeaderSection";
import type { TaskDetailItem } from "./TaskDetailSheet";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { TaskStatusBadge } from "./TaskStatusBadge";

interface TaskListViewProps {
	tasks: TaskDetailItem[];
	projectCode: string;
	today: string;
	onSelectTask: (task: TaskDetailItem) => void;
	view?: "list" | "board" | "gantt" | "calendar";
	onViewChange?: (view: "list" | "board" | "gantt" | "calendar") => void;
	onAddTask?: () => void;
	access?: ProjectAccess;
}

export function TaskListView({
	tasks,
	projectCode,
	today,
	onSelectTask,
	view = "list",
	onViewChange,
	onAddTask,
	access,
}: TaskListViewProps) {
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [priorityFilter, setPriorityFilter] = useState("all");

	const filteredTasks = useMemo(() => {
		return tasks.filter((task) => {
			if (statusFilter !== "all" && task.status !== statusFilter) return false;
			if (priorityFilter !== "all" && task.priority !== priorityFilter)
				return false;
			if (search.trim()) {
				const q = search.toLowerCase().trim();
				const matchNum = `#${task.taskNumber}`.includes(q);
				const matchTitle = task.title.toLowerCase().includes(q);
				const matchAssignee = task.assigneeName?.toLowerCase().includes(q);
				const matchStage = task.stageKey?.toLowerCase().includes(q);
				if (!matchNum && !matchTitle && !matchAssignee && !matchStage)
					return false;
			}
			return true;
		});
	}, [tasks, search, statusFilter, priorityFilter]);

	return (
		<div className="space-y-4">
			<DataTableToolbar>
				<DataTableFilters>
					<div className="relative w-full max-w-xs">
						<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
						<Input
							placeholder="Search by #num, title or assignee..."
							className="pl-9 h-8 text-xs"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>

					<Select
						value={statusFilter}
						onValueChange={(v) => v && setStatusFilter(v)}
					>
						<SelectTrigger className="h-8 w-32 text-xs">
							<SelectValue placeholder="All Statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="todo">To Do</SelectItem>
							<SelectItem value="in_progress">In Progress</SelectItem>
							<SelectItem value="blocked">Blocked</SelectItem>
							<SelectItem value="in_review">In Review</SelectItem>
							<SelectItem value="done">Done</SelectItem>
							<SelectItem value="cancelled">Cancelled</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={priorityFilter}
						onValueChange={(v) => v && setPriorityFilter(v)}
					>
						<SelectTrigger className="h-8 w-28 text-xs">
							<SelectValue placeholder="All Priorities" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Priorities</SelectItem>
							<SelectItem value="critical">Critical</SelectItem>
							<SelectItem value="high">High</SelectItem>
							<SelectItem value="medium">Medium</SelectItem>
							<SelectItem value="low">Low</SelectItem>
						</SelectContent>
					</Select>
				</DataTableFilters>

				<div className="flex items-center gap-2.5">
					<div className="hidden text-xs text-muted-foreground sm:inline-block">
						Showing{" "}
						<strong className="text-foreground">{filteredTasks.length}</strong>{" "}
						of {tasks.length} tasks
					</div>

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
											view === v.value
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

			<DataTableContainer>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[85px]">Task #</TableHead>
							<TableHead className="min-w-[260px]">Title</TableHead>
							<TableHead className="w-[110px]">Stage</TableHead>
							<TableHead className="w-[150px]">Assignee</TableHead>
							<TableHead className="w-[100px]">Priority</TableHead>
							<TableHead className="w-[120px]">Due Date</TableHead>
							<TableHead className="w-[90px]">Hours</TableHead>
							<TableHead className="w-[120px]">Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredTasks.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={8}
									className="h-28 text-center text-muted-foreground"
								>
									No tasks found matching your filter criteria.
								</TableCell>
							</TableRow>
						) : (
							filteredTasks.map((task) => {
								const isOverdue =
									task.status !== "done" &&
									task.status !== "cancelled" &&
									task.dueDate &&
									task.dueDate < today;

								return (
									<TableRow
										key={task.id}
										className="cursor-pointer hover:bg-muted/50"
										onClick={() => onSelectTask(task)}
									>
										<TableCell className="font-mono text-xs font-semibold text-primary">
											{projectCode} #{task.taskNumber}
										</TableCell>
										<TableCell>
											<div className="min-w-0 flex items-center gap-2">
												<span className="font-medium text-foreground truncate">
													{task.title}
												</span>
												{task.subtaskCount ? (
													<span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 border border-border shrink-0">
														{task.subtaskCount} subtasks
													</span>
												) : null}
											</div>
										</TableCell>
										<TableCell>
											<span className="text-xs capitalize text-muted-foreground">
												{task.stageKey || "—"}
											</span>
										</TableCell>
										<TableCell>
											{task.assigneeName ? (
												<div className="flex items-center gap-2 min-w-0">
													<Avatar className="size-5 shrink-0">
														<AvatarImage
															src={task.assigneeAvatarUrl || undefined}
														/>
														<AvatarFallback className="text-[9px]">
															{task.assigneeName.slice(0, 2).toUpperCase()}
														</AvatarFallback>
													</Avatar>
													<span className="truncate text-xs text-foreground">
														{task.assigneeName}
													</span>
												</div>
											) : (
												<span className="text-xs text-muted-foreground">
													Unassigned
												</span>
											)}
										</TableCell>
										<TableCell>
											<TaskPriorityBadge priority={task.priority} />
										</TableCell>
										<TableCell>
											<span
												className={cn(
													"text-xs",
													isOverdue
														? "font-semibold text-destructive"
														: "text-muted-foreground",
												)}
											>
												{task.dueDate ? formatDateDisplay(task.dueDate) : "—"}
												{isOverdue && " ⚠️"}
											</span>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{task.estimateHours != null
												? `${task.estimateHours}h`
												: "—"}
											{task.actualHours != null && ` / ${task.actualHours}h`}
										</TableCell>
										<TableCell>
											<TaskStatusBadge status={task.status} />
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</DataTableContainer>
		</div>
	);
}
