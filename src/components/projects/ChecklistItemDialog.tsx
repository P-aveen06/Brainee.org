"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	createChecklistItem,
	updateChecklistItem,
} from "@/api/project-checklists";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { ChecklistItemData } from "./ChecklistItemRow";

interface ChecklistItemDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	stages: Array<{ key: string; name: string }>;
	members: Array<{ userId: string; userName: string | null }>;
	defaultStageKey?: string;
	itemToEdit?: ChecklistItemData | null;
	onSuccess: () => void;
}

export function ChecklistItemDialog({
	open,
	onOpenChange,
	projectId,
	stages,
	members,
	defaultStageKey,
	itemToEdit,
	onSuccess,
}: ChecklistItemDialogProps) {
	const [isPending, startTransition] = useTransition();

	const [stageKey, setStageKey] = useState(
		defaultStageKey || stages[0]?.key || "planning",
	);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [isRequired, setIsRequired] = useState(false);
	const [assignedToId, setAssignedToId] = useState<string>("none");
	const [dueDate, setDueDate] = useState("");
	const [notes, setNotes] = useState("");

	// biome-ignore lint/correctness/useExhaustiveDependencies: Only reinitialize form when dialog opens or edited item changes
	useEffect(() => {
		if (!open) return;
		if (itemToEdit) {
			setStageKey(itemToEdit.stageKey);
			setTitle(itemToEdit.title);
			setDescription(itemToEdit.description || "");
			setIsRequired(itemToEdit.isRequired);
			setAssignedToId(itemToEdit.assignedToId || "none");
			setDueDate(itemToEdit.dueDate || "");
			setNotes(itemToEdit.notes || "");
		} else {
			setStageKey(defaultStageKey || stages[0]?.key || "planning");
			setTitle("");
			setDescription("");
			setIsRequired(false);
			setAssignedToId("none");
			setDueDate("");
			setNotes("");
		}
	}, [open, itemToEdit?.id]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;

		startTransition(async () => {
			try {
				if (itemToEdit) {
					const res = await updateChecklistItem({
						data: {
							itemId: itemToEdit.id,
							title: title.trim(),
							description: description.trim() || undefined,
							isRequired,
							assignedToId: assignedToId === "none" ? null : assignedToId,
							dueDate: dueDate || null,
							notes: notes.trim() || undefined,
						},
					});

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success("Checklist item updated");
						onOpenChange(false);
						onSuccess();
					}
				} else {
					const res = await createChecklistItem({
						data: {
							projectId,
							stageKey,
							title: title.trim(),
							description: description.trim() || undefined,
							isRequired,
							assignedToId: assignedToId === "none" ? null : assignedToId,
							dueDate: dueDate || null,
						},
					});

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success("Checklist item added");
						onOpenChange(false);
						onSuccess();
					}
				}
			} catch (_err) {
				toast.error("Failed to save checklist item");
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle>
							{itemToEdit ? "Edit Checklist Item" : "New Checklist Item"}
						</DialogTitle>
						<DialogDescription>
							Items can be required for stage advancement or optional
							deliverables.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3.5 py-1">
						<div className="space-y-1.5">
							<Label htmlFor="itemTitle">
								Title <span className="text-destructive">*</span>
							</Label>
							<Input
								id="itemTitle"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="e.g. Conduct security penetration review"
								required
								autoFocus
							/>
						</div>

						{!itemToEdit && (
							<div className="space-y-1.5">
								<Label htmlFor="itemStage">Project Stage</Label>
								<Select
									value={stageKey}
									onValueChange={(v) => v && setStageKey(v)}
								>
									<SelectTrigger id="itemStage">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{stages.map((s) => (
											<SelectItem key={s.key} value={s.key}>
												{s.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}

						<div className="space-y-1.5">
							<Label htmlFor="itemDesc">Description</Label>
							<Textarea
								id="itemDesc"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Context, criteria or links..."
								rows={2}
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="itemAssignee">Assignee</Label>
								<Select
									value={assignedToId}
									onValueChange={(v) => v && setAssignedToId(v)}
								>
									<SelectTrigger id="itemAssignee">
										<SelectValue placeholder="Unassigned" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Unassigned</SelectItem>
										{members.map((m) => (
											<SelectItem key={m.userId} value={m.userId}>
												{m.userName || "Team Member"}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="itemDue">Due Date</Label>
								<Input
									id="itemDue"
									type="date"
									value={dueDate}
									onChange={(e) => setDueDate(e.target.value)}
								/>
							</div>
						</div>

						<div className="pt-1">
							<label
								htmlFor="itemRequired"
								className="flex cursor-pointer items-center gap-2 select-none"
							>
								<Checkbox
									id="itemRequired"
									checked={isRequired}
									onCheckedChange={(checked) => setIsRequired(Boolean(checked))}
								/>
								<div className="space-y-0.5">
									<span className="text-xs font-semibold block text-foreground">
										Required for stage completion
									</span>
									<span className="text-[11px] text-muted-foreground block">
										Advancing to the next stage will block until this item is
										done.
									</span>
								</div>
							</label>
						</div>
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
						<Button type="submit" disabled={isPending || !title.trim()}>
							{isPending
								? "Saving..."
								: itemToEdit
									? "Save Changes"
									: "Add Item"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
