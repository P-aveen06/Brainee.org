"use client";

import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { DataTableContainer } from "@/components/layout/data-table-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { TaskStatusBadge } from "./TaskStatusBadge";

interface MyTaskItem {
	id: string;
	projectId: string;
	projectCode: string;
	projectName: string;
	taskNumber: number;
	title: string;
	priority: string;
	status: string;
	dueDate: string | null;
	estimateHours: number | null;
}

interface MyTasksProjectGroupProps {
	projectId: string;
	tasks: MyTaskItem[];
	today: string;
}

export function MyTasksProjectGroup({
	projectId,
	tasks,
	today,
}: MyTasksProjectGroupProps) {
	const navigate = useNavigate();
	const sample = tasks[0];
	if (!sample) return null;

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="font-mono text-xs font-semibold text-primary px-2 py-0.5 bg-primary/10 border border-primary/20">
						{sample.projectCode}
					</span>
					<h3 className="font-heading text-sm font-semibold text-foreground">
						{sample.projectName}
					</h3>
					<Badge variant="outline" className="text-[10px]">
						{tasks.length}
					</Badge>
				</div>

				<Button
					variant="ghost"
					size="sm"
					className="text-xs h-7 text-primary hover:text-primary/80"
					onClick={() =>
						navigate({
							to: "/projects/$id",
							params: { id: projectId },
						})
					}
				>
					Go to Project
					<ArrowRight className="ml-1.5 size-3.5" />
				</Button>
			</div>

			<DataTableContainer>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[85px]">Task #</TableHead>
							<TableHead className="min-w-[280px]">Title</TableHead>
							<TableHead className="w-[100px]">Priority</TableHead>
							<TableHead className="w-[120px]">Due Date</TableHead>
							<TableHead className="w-[90px]">Est. Hours</TableHead>
							<TableHead className="w-[120px]">Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{tasks.map((task) => {
							const isOverdue =
								task.status !== "done" &&
								task.status !== "cancelled" &&
								task.dueDate &&
								task.dueDate < today;

							return (
								<TableRow
									key={task.id}
									className="cursor-pointer hover:bg-muted/50"
									onClick={() =>
										navigate({
											to: "/projects/$id",
											params: { id: task.projectId },
										})
									}
								>
									<TableCell className="font-mono text-xs font-semibold text-primary">
										#{task.taskNumber}
									</TableCell>
									<TableCell>
										<span className="font-medium text-foreground truncate block max-w-lg">
											{task.title}
										</span>
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
									</TableCell>
									<TableCell>
										<TaskStatusBadge status={task.status} />
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</DataTableContainer>
		</div>
	);
}
