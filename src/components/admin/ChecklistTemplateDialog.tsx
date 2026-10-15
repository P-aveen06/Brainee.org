"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { upsertChecklistTemplate } from "@/api/project-checklist-templates";
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
import type { ChecklistTemplateItem } from "./ChecklistTemplateManager";

interface ChecklistTemplateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	stages: Array<{ key: string; name: string }>;
	templateToEdit: ChecklistTemplateItem | null;
	stageKey: string;
	onStageKeyChange: (k: string) => void;
	title: string;
	onTitleChange: (t: string) => void;
	description: string;
	onDescriptionChange: (d: string) => void;
	isRequired: boolean;
	onIsRequiredChange: (r: boolean) => void;
	sequence: string;
	onSequenceChange: (s: string) => void;
	onSuccess: () => void;
}

export function ChecklistTemplateDialog({
	open,
	onOpenChange,
	stages,
	templateToEdit,
	stageKey,
	onStageKeyChange,
	title,
	onTitleChange,
	description,
	onDescriptionChange,
	isRequired,
	onIsRequiredChange,
	sequence,
	onSequenceChange,
	onSuccess,
}: ChecklistTemplateDialogProps) {
	const [isPending, startTransition] = useTransition();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;

		startTransition(async () => {
			try {
				const res = await upsertChecklistTemplate({
					data: {
						id: templateToEdit?.id,
						stageKey,
						title: title.trim(),
						description: description.trim() || undefined,
						isRequired,
						sequence: Number(sequence) || 0,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success(
						templateToEdit
							? "Template updated successfully"
							: "Checklist template added",
					);
					onOpenChange(false);
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to save template");
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle>
							{templateToEdit ? "Edit Template Item" : "New Checklist Template"}
						</DialogTitle>
						<DialogDescription>
							Define standardized stage criteria enforced for all new projects.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3.5 py-1">
						<div className="space-y-1.5">
							<Label htmlFor="tmplStage">Target Stage</Label>
							<Select
								value={stageKey}
								onValueChange={(v) => v && onStageKeyChange(v)}
							>
								<SelectTrigger id="tmplStage">
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

						<div className="space-y-1.5">
							<Label htmlFor="tmplTitle">
								Requirement Title <span className="text-destructive">*</span>
							</Label>
							<Input
								id="tmplTitle"
								value={title}
								onChange={(e) => onTitleChange(e.target.value)}
								placeholder="e.g. Executive Commercial Sign-off"
								required
								autoFocus
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="tmplDesc">Description</Label>
							<Textarea
								id="tmplDesc"
								value={description}
								onChange={(e) => onDescriptionChange(e.target.value)}
								placeholder="Guidance, compliance rules, or links..."
								rows={2}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="tmplSeq">Sequence</Label>
							<Input
								id="tmplSeq"
								type="number"
								value={sequence}
								onChange={(e) => onSequenceChange(e.target.value)}
								required
							/>
						</div>

						<div className="pt-1">
							<label
								htmlFor="tmplRequired"
								className="flex cursor-pointer items-center gap-2 select-none"
							>
								<Checkbox
									id="tmplRequired"
									checked={isRequired}
									onCheckedChange={(checked) =>
										onIsRequiredChange(Boolean(checked))
									}
								/>
								<div className="space-y-0.5">
									<span className="text-xs font-semibold block text-foreground">
										Required for stage completion
									</span>
									<span className="text-[11px] text-muted-foreground block">
										Advancing past this stage will be blocked until complete.
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
							{isPending ? "Saving..." : "Save Template"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
