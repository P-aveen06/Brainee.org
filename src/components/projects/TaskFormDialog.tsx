"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTask, updateTask } from "@/api/project-tasks";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TaskScheduleHoursFields } from "./TaskScheduleHoursFields";
import { TaskStageAssigneeFields } from "./TaskStageAssigneeFields";

export interface TaskFormItem {
	id: string;
	title: string;
	description?: string | null;
	priority: "low" | "medium" | "high" | "critical";
	stageKey?: string | null;
	assigneeId?: string | null;
	startDate?: string | null;
	dueDate?: string | null;
	estimateHours?: number | null;
	actualHours?: number | null;
	parentTaskId?: string | null;
}

interface MemberOption {
	userId: string;
	userName?: string | null;
}

interface StageOption {
	key: string;
	name: string;
}

interface TaskFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	stages: StageOption[];
	members: MemberOption[];
	taskToEdit?: TaskFormItem | null;
	parentTaskId?: string | null;
	onSuccess: () => void;
}

export function TaskFormDialog({
	open,
	onOpenChange,
	projectId,
	stages,
	members,
	taskToEdit,
	parentTaskId,
	onSuccess,
}: TaskFormDialogProps) {
	const [isPending, startTransition] = useTransition();

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [priority, setPriority] = useState<
		"low" | "medium" | "high" | "critical"
	>("medium");
	const [stageKey, setStageKey] = useState<string>("none");
	const [assigneeId, setAssigneeId] = useState<string>("none");
	const [startDate, setStartDate] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [estimateHours, setEstimateHours] = useState("");
	const [actualHours, setActualHours] = useState("");

	useEffect(() => {
		if (taskToEdit) {
			setTitle(taskToEdit.title || "");
			setDescription(taskToEdit.description || "");
			setPriority(taskToEdit.priority || "medium");
			setStageKey(taskToEdit.stageKey || "none");
			setAssigneeId(taskToEdit.assigneeId || "none");
			setStartDate(taskToEdit.startDate || "");
			setDueDate(taskToEdit.dueDate || "");
			setEstimateHours(
				taskToEdit.estimateHours != null
					? String(taskToEdit.estimateHours)
					: "",
			);
			setActualHours(
				taskToEdit.actualHours != null ? String(taskToEdit.actualHours) : "",
			);
		} else {
			setTitle("");
			setDescription("");
			setPriority("medium");
			setStageKey(stages[0]?.key || "none");
			setAssigneeId("none");
			setStartDate("");
			setDueDate("");
			setEstimateHours("");
			setActualHours("");
		}
	}, [taskToEdit, stages]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) {
			toast.error("Please enter a task title.");
			return;
		}

		startTransition(async () => {
			try {
				const numEst = estimateHours ? Number.parseFloat(estimateHours) : null;
				const numAct = actualHours ? Number.parseFloat(actualHours) : null;
				const parsedStage = stageKey === "none" ? null : stageKey;
				const parsedAssignee = assigneeId === "none" ? null : assigneeId;

				if (taskToEdit) {
					const res = await updateTask({
						data: {
							id: taskToEdit.id,
							projectId,
							title: title.trim(),
							description: description.trim() || null,
							priority,
							stageKey: parsedStage,
							assigneeId: parsedAssignee,
							startDate: startDate || null,
							dueDate: dueDate || null,
							estimateHours: numEst,
							actualHours: numAct,
						},
					});

					if ("error" in res && res.error) {
						toast.error(res.error);
						return;
					}
					toast.success("Task updated.");
				} else {
					await createTask({
						data: {
							projectId,
							title: title.trim(),
							description: description.trim() || null,
							priority,
							stageKey: parsedStage,
							assigneeId: parsedAssignee,
							startDate: startDate || null,
							dueDate: dueDate || null,
							estimateHours: numEst,
							parentTaskId: parentTaskId || null,
						},
					});
					toast.success("Task created.");
				}

				onOpenChange(false);
				onSuccess();
			} catch (_err) {
				toast.error("Failed to save task.");
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>
							{taskToEdit
								? "Edit Task"
								: parentTaskId
									? "New Subtask"
									: "New Task"}
						</DialogTitle>
						<DialogDescription>
							{taskToEdit
								? "Update task requirements, priority, and timeline."
								: "Add a work item to track deliverables and progress."}
						</DialogDescription>
					</DialogHeader>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
						<div className="sm:col-span-2 space-y-1.5">
							<Label htmlFor="taskTitle">
								Title <span className="text-destructive">*</span>
							</Label>
							<Input
								id="taskTitle"
								placeholder="e.g. Implement OAuth2 Refresh Token Rotation"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								required
							/>
						</div>

						<div className="sm:col-span-2 space-y-1.5">
							<Label htmlFor="taskDesc">Description</Label>
							<Textarea
								id="taskDesc"
								placeholder="Technical notes, acceptance criteria, or links..."
								rows={3}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="priority">Priority</Label>
							<Select
								value={priority}
								onValueChange={(v) => {
									if (v) setPriority(v as typeof priority);
								}}
							>
								<SelectTrigger id="priority">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="low">Low</SelectItem>
									<SelectItem value="medium">Medium</SelectItem>
									<SelectItem value="high">High</SelectItem>
									<SelectItem value="critical">Critical</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<TaskStageAssigneeFields
							stageKey={stageKey}
							onStageKeyChange={setStageKey}
							stages={stages}
							assigneeId={assigneeId}
							onAssigneeIdChange={setAssigneeId}
							members={members}
						/>

						<TaskScheduleHoursFields
							startDate={startDate}
							onStartDateChange={setStartDate}
							dueDate={dueDate}
							onDueDateChange={setDueDate}
							estimateHours={estimateHours}
							onEstimateHoursChange={setEstimateHours}
							actualHours={actualHours}
							onActualHoursChange={setActualHours}
							showActualHours={Boolean(taskToEdit)}
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending
								? "Saving..."
								: taskToEdit
									? "Save Changes"
									: "Create Task"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
