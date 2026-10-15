"use client";

import { AlertCircle, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateTaskStatus } from "@/api/project-tasks";
import { DataTableToolbar } from "@/components/layout/data-table-layout";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectAccess } from "@/lib/project-access";
import { cn } from "@/lib/utils";
import { VIEW_PILLS } from "./ProjectHeaderSection";
import { TaskBoardCard } from "./TaskBoardCard";
import type { TaskDetailItem } from "./TaskDetailSheet";
import { TASK_STATUS_CONFIG, type TaskStatusKey } from "./taskStatusStyles";

interface TaskBoardViewProps {
	tasks: TaskDetailItem[];
	projectCode: string;
	access: ProjectAccess;
	today: string;
	onSelectTask: (task: TaskDetailItem) => void;
	onAddTask: () => void;
	onSuccess: () => void;
	view?: "list" | "board" | "gantt" | "calendar";
	onViewChange?: (view: "list" | "board" | "gantt" | "calendar") => void;
}

const BOARD_COLUMNS: {
	key: TaskStatusKey;
	title: string;
}[] = [
	{ key: "todo", title: "To Do" },
	{ key: "in_progress", title: "In Progress" },
	{ key: "blocked", title: "Blocked" },
	{ key: "in_review", title: "In Review" },
	{ key: "done", title: "Done" },
];

export function TaskBoardView({
	tasks,
	projectCode,
	access,
	today,
	onSelectTask,
	onAddTask,
	onSuccess,
	view = "board",
	onViewChange,
}: TaskBoardViewProps) {
	const [isPending, startTransition] = useTransition();

	// Blocked Reason Dialog State
	const [blockedPromptOpen, setBlockedPromptOpen] = useState(false);
	const [pendingBlockedTask, setPendingBlockedTask] =
		useState<TaskDetailItem | null>(null);
	const [blockedReasonInput, setBlockedReasonInput] = useState("");

	const handleMoveStatus = (
		task: TaskDetailItem,
		targetStatus: TaskStatusKey,
	) => {
		if (targetStatus === task.status) return;

		if (targetStatus === "blocked") {
			setPendingBlockedTask(task);
			setBlockedReasonInput(task.blockedReason || "");
			setBlockedPromptOpen(true);
			return;
		}

		executeStatusUpdate(task.id, targetStatus);
	};

	const executeStatusUpdate = (
		taskId: string,
		status: TaskStatusKey,
		blockedReason?: string,
	) => {
		startTransition(async () => {
			try {
				const res = await updateTaskStatus({
					data: {
						taskId,
						status,
						blockedReason,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success(`Task moved to ${TASK_STATUS_CONFIG[status].label}`);
					setBlockedPromptOpen(false);
					setPendingBlockedTask(null);
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to update status");
			}
		});
	};

	const handleConfirmBlocked = (e: React.FormEvent) => {
		e.preventDefault();
		if (!pendingBlockedTask) return;
		if (!blockedReasonInput.trim()) {
			toast.error("Please provide a reason why this task is blocked.");
			return;
		}
		executeStatusUpdate(
			pendingBlockedTask.id,
			"blocked",
			blockedReasonInput.trim(),
		);
	};

	return (
		<div className="space-y-4">
			{/* Standardized Toolbar */}
			<DataTableToolbar>
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">
						Showing <strong className="text-foreground">{tasks.length}</strong>{" "}
						tasks across {BOARD_COLUMNS.length} stages
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
											(view || "board") === v.value
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

					{access.canContribute && (
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

			{/* Board Horizontal Scroll Container */}
			<div className="overflow-x-auto pb-4">
				<div className="flex gap-4 min-w-[1050px]">
					{BOARD_COLUMNS.map((col) => {
						const colTasks = tasks.filter((t) => t.status === col.key);
						const config = TASK_STATUS_CONFIG[col.key];

						return (
							<div
								key={col.key}
								className="flex-1 min-w-[210px] max-w-[260px] bg-muted/40 border border-border flex flex-col max-h-[calc(100vh-280px)] shadow-2xs"
							>
								{/* Column Header */}
								<div className="p-3 border-b border-border flex items-center justify-between bg-card/60">
									<div className="flex items-center gap-2">
										<span className={cn("size-2 rounded-full", config.dot)} />
										<span className="text-xs font-semibold text-foreground tracking-tight">
											{col.title}
										</span>
										<span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2">
											{colTasks.length}
										</span>
									</div>

									{access.canContribute && col.key === "todo" && (
										<Button
											variant="ghost"
											size="icon-xs"
											className="size-6 p-0"
											onClick={onAddTask}
											title="Add task"
										>
											<Plus className="size-3.5" />
										</Button>
									)}
								</div>

								{/* Column Task Cards */}
								<div className="flex-1 overflow-y-auto p-2 space-y-2">
									{colTasks.length === 0 ? (
										<div className="h-24 flex items-center justify-center border border-dashed border-border/80 text-xs text-muted-foreground">
											No tasks
										</div>
									) : (
										colTasks.map((task) => (
											<TaskBoardCard
												key={task.id}
												task={task}
												projectCode={projectCode}
												access={access}
												today={today}
												boardColumns={BOARD_COLUMNS}
												isPending={isPending}
												onSelectTask={onSelectTask}
												onMoveStatus={handleMoveStatus}
											/>
										))
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Blocked Reason Required Prompt Modal */}
			<Dialog open={blockedPromptOpen} onOpenChange={setBlockedPromptOpen}>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<AlertCircle className="size-4" />
							Provide Blocker Reason
						</DialogTitle>
						<DialogDescription>
							Moving this task to <strong>Blocked</strong> requires a blocker
							explanation so the project leads and team can resolve it.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleConfirmBlocked} className="space-y-4 py-2">
						<Textarea
							placeholder="e.g. Waiting on client credential access or dependency deployment..."
							rows={3}
							value={blockedReasonInput}
							onChange={(e) => setBlockedReasonInput(e.target.value)}
							required
							autoFocus
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setBlockedPromptOpen(false)}
								disabled={isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="destructive"
								disabled={isPending || !blockedReasonInput.trim()}
							>
								{isPending ? "Marking Blocked..." : "Confirm Blocker"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
