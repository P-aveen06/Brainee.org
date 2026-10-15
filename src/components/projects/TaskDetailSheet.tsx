"use client";

import { Edit, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTask, updateTaskStatus } from "@/api/project-tasks";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { ProjectAccess } from "@/lib/project-access";
import { TaskBlockedDialog } from "./TaskBlockedDialog";
import { TaskDeleteConfirmDialog } from "./TaskDeleteConfirmDialog";
import { TaskMetadataGrid } from "./TaskMetadataGrid";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskStatusBanners } from "./TaskStatusBanners";

export interface TaskDetailItem {
	id: string;
	projectId: string;
	stageKey: string | null;
	parentTaskId: string | null;
	taskNumber: number;
	title: string;
	description: string | null;
	status: string;
	priority: string;
	assigneeId: string | null;
	assigneeName: string | null;
	assigneeEmail: string | null;
	assigneeAvatarUrl: string | null;
	startDate: string | null;
	dueDate: string | null;
	completedAt: Date | null;
	estimateHours: number | null;
	actualHours: number | null;
	blockedReason: string | null;
	stageName?: string | null;
	subtaskCount?: number;
	assignee?: {
		id: string;
		name?: string | null;
		email?: string | null;
		avatarUrl?: string | null;
	} | null;
	createdAt: Date | null;
}

interface TaskDetailSheetProps {
	task: TaskDetailItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectCode: string;
	access: ProjectAccess;
	today: string;
	onEdit: (task: TaskDetailItem) => void;
	onAddSubtask: (parentTaskId: string) => void;
	onSuccess: () => void;
}

export function TaskDetailSheet({
	task,
	open,
	onOpenChange,
	projectCode,
	access,
	today,
	onEdit,
	onAddSubtask,
	onSuccess,
}: TaskDetailSheetProps) {
	const [isPending, startTransition] = useTransition();
	const [blockedModalOpen, setBlockedModalOpen] = useState(false);
	const [blockedReasonInput, setBlockedReasonInput] = useState("");
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);

	if (!task) return null;

	const isOverdue = Boolean(
		task.dueDate &&
			task.dueDate < today &&
			task.status !== "done" &&
			task.status !== "cancelled",
	);

	const handleStatusChange = (newStatus: string | null) => {
		if (!newStatus || newStatus === task.status) return;

		if (newStatus === "blocked") {
			setBlockedReasonInput(task.blockedReason || "");
			setBlockedModalOpen(true);
			return;
		}

		startTransition(async () => {
			try {
				const res = await updateTaskStatus({
					data: {
						taskId: task.id,
						status: newStatus as
							| "todo"
							| "in_progress"
							| "blocked"
							| "in_review"
							| "done"
							| "cancelled",
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success(`Task moved to ${newStatus.replace(/_/g, " ")}`);
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to update status");
			}
		});
	};

	const handleConfirmBlocked = () => {
		if (!blockedReasonInput.trim()) return;

		startTransition(async () => {
			try {
				const res = await updateTaskStatus({
					data: {
						taskId: task.id,
						status: "blocked",
						blockedReason: blockedReasonInput.trim(),
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Task marked as blocked");
					setBlockedModalOpen(false);
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to update status");
			}
		});
	};

	const handleDelete = () => {
		startTransition(async () => {
			try {
				const res = await deleteTask({
					data: { taskId: task.id },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Task deleted successfully");
					setDeleteModalOpen(false);
					onOpenChange(false);
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to delete task");
			}
		});
	};

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent className="sm:max-w-xl">
					<SheetHeader className="space-y-3 px-5 py-4">
						<div className="flex items-center justify-between">
							<span className="font-mono text-xs font-semibold text-primary">
								{projectCode} #{task.taskNumber}
							</span>
							<div className="flex items-center gap-2">
								<TaskPriorityBadge priority={task.priority} />
								<TaskStatusBadge status={task.status} />
							</div>
						</div>

						<SheetTitle className="text-xl font-heading font-semibold text-foreground text-left leading-snug">
							{task.title}
						</SheetTitle>

						{task.stageName && (
							<SheetDescription className="text-left text-xs">
								Stage:{" "}
								<span className="font-medium text-foreground">
									{task.stageName}
								</span>
							</SheetDescription>
						)}
					</SheetHeader>

					<SheetBody className="space-y-5 px-5 py-5">
						<TaskStatusBanners
							status={task.status}
							blockedReason={task.blockedReason}
							dueDate={task.dueDate}
							isOverdue={isOverdue}
							canContribute={access.canContribute}
							isPending={isPending}
							onStatusChange={handleStatusChange}
						/>

						<div className="space-y-1.5">
							<span className="text-[11px] font-medium text-muted-foreground">
								Description
							</span>
							<div className="rounded-xl border border-border/70 bg-surface p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
								{task.description ||
									"No description provided for this work item."}
							</div>
						</div>

						<TaskMetadataGrid task={task} />
					</SheetBody>

					<SheetFooter className="flex-row items-center justify-between px-5 py-4 sm:justify-between">
						<div className="flex items-center gap-2">
							{access.canContribute && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => onEdit(task)}
								>
									<Edit className="mr-1.5 size-3.5" />
									Edit
								</Button>
							)}
							{access.canContribute && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => onAddSubtask(task.id)}
								>
									<Plus className="mr-1.5 size-3.5" />
									Add Subtask
								</Button>
							)}
						</div>

						{access.canManage && (
							<Button
								variant="ghost"
								size="sm"
								className="text-destructive hover:bg-destructive/10"
								onClick={() => setDeleteModalOpen(true)}
							>
								<Trash2 className="size-4" />
							</Button>
						)}
					</SheetFooter>
				</SheetContent>
			</Sheet>

			{/* Subcomponent Dialogs */}
			<TaskBlockedDialog
				open={blockedModalOpen}
				onOpenChange={setBlockedModalOpen}
				reason={blockedReasonInput}
				onReasonChange={setBlockedReasonInput}
				onConfirm={handleConfirmBlocked}
				isPending={isPending}
			/>

			<TaskDeleteConfirmDialog
				open={deleteModalOpen}
				onOpenChange={setDeleteModalOpen}
				taskNumber={task.taskNumber}
				projectCode={projectCode}
				onConfirm={handleDelete}
				isPending={isPending}
			/>
		</>
	);
}
