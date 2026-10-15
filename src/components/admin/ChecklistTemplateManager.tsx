"use client";

import { Edit, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteChecklistTemplate } from "@/api/project-checklist-templates";
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
import { ChecklistTemplateDialog } from "./ChecklistTemplateDialog";

export interface ChecklistTemplateItem {
	id: string;
	stageKey: string;
	title: string;
	description?: string | null;
	isRequired: boolean;
	sequence: number;
}

interface ChecklistTemplateManagerProps {
	stages: Array<{ key: string; name: string }>;
	templates: ChecklistTemplateItem[];
	onSuccess: () => void;
}

export function ChecklistTemplateManager({
	stages,
	templates,
	onSuccess,
}: ChecklistTemplateManagerProps) {
	const [isPending, startTransition] = useTransition();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [templateToEdit, setTemplateToEdit] =
		useState<ChecklistTemplateItem | null>(null);

	const [stageKey, setStageKey] = useState(stages[0]?.key || "planning");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [isRequired, setIsRequired] = useState(false);
	const [sequence, setSequence] = useState("1");

	const handleOpenCreate = () => {
		setTemplateToEdit(null);
		setStageKey(stages[0]?.key || "planning");
		setTitle("");
		setDescription("");
		setIsRequired(false);
		setSequence(String(templates.length + 1));
		setDialogOpen(true);
	};

	const handleOpenEdit = (t: ChecklistTemplateItem) => {
		setTemplateToEdit(t);
		setStageKey(t.stageKey);
		setTitle(t.title);
		setDescription(t.description || "");
		setIsRequired(t.isRequired);
		setSequence(String(t.sequence));
		setDialogOpen(true);
	};

	const handleDelete = (id: string) => {
		startTransition(async () => {
			try {
				const res = await deleteChecklistTemplate({
					data: { id },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Template removed");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to delete template");
			}
		});
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between border-b border-border pb-3">
				<div>
					<h3 className="font-heading text-sm font-semibold text-foreground">
						Default Stage Checklist Templates ({templates.length})
					</h3>
					<p className="text-xs text-muted-foreground">
						Automatically instantiated whenever a project enters a stage.
					</p>
				</div>

				<Button size="sm" onClick={handleOpenCreate} className="text-xs">
					<Plus className="mr-1.5 size-3.5" />
					Add Template Item
				</Button>
			</div>

			<div className="border border-border overflow-hidden bg-card">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[140px]">Stage</TableHead>
							<TableHead>Checklist Requirement</TableHead>
							<TableHead className="w-[100px]">Gate Type</TableHead>
							<TableHead className="w-[80px]">Seq</TableHead>
							<TableHead className="w-[80px] text-right" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{templates.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={5}
									className="h-24 text-center text-muted-foreground"
								>
									No checklist templates configured.
								</TableCell>
							</TableRow>
						) : (
							templates.map((t) => {
								const stageName =
									stages.find((s) => s.key === t.stageKey)?.name || t.stageKey;
								return (
									<TableRow key={t.id}>
										<TableCell className="text-xs font-semibold text-foreground capitalize">
											{stageName}
										</TableCell>
										<TableCell>
											<div className="space-y-0.5">
												<p className="text-xs font-medium text-foreground">
													{t.title}
												</p>
												{t.description && (
													<p className="text-[11px] text-muted-foreground">
														{t.description}
													</p>
												)}
											</div>
										</TableCell>
										<TableCell>
											{t.isRequired ? (
												<Badge
													variant="outline"
													className="border-destructive/40 text-destructive bg-destructive/5 text-[10px]"
												>
													Required
												</Badge>
											) : (
												<Badge variant="outline" className="text-[10px]">
													Optional
												</Badge>
											)}
										</TableCell>
										<TableCell className="font-mono text-xs text-muted-foreground">
											#{t.sequence}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex items-center justify-end gap-1">
												<Button
													variant="ghost"
													size="icon-xs"
													className="size-7"
													onClick={() => handleOpenEdit(t)}
												>
													<Edit className="size-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="icon-xs"
													className="size-7 text-destructive hover:bg-destructive/10"
													onClick={() => handleDelete(t.id)}
													disabled={isPending}
												>
													<Trash2 className="size-3.5" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>

			{/* Upsert Template Modal Subcomponent */}
			<ChecklistTemplateDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				stages={stages}
				templateToEdit={templateToEdit}
				stageKey={stageKey}
				onStageKeyChange={setStageKey}
				title={title}
				onTitleChange={setTitle}
				description={description}
				onDescriptionChange={setDescription}
				isRequired={isRequired}
				onIsRequiredChange={setIsRequired}
				sequence={sequence}
				onSequenceChange={setSequence}
				onSuccess={onSuccess}
			/>
		</div>
	);
}
