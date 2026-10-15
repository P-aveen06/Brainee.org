"use client";

import { CheckSquare, Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	deleteChecklistItem,
	toggleChecklistItem,
} from "@/api/project-checklists";
import { DataTableToolbar } from "@/components/layout/data-table-layout";
import { Button } from "@/components/ui/button";
import type { ProjectAccess } from "@/lib/project-access";
import { assessStageChecklist } from "@/lib/project-stage-policy";
import { cn } from "@/lib/utils";
import { ChecklistItemDialog } from "./ChecklistItemDialog";
import { type ChecklistItemData, ChecklistItemRow } from "./ChecklistItemRow";
import { StageChecklistSummary } from "./StageChecklistSummary";

interface ChecklistPanelProps {
	projectId: string;
	currentStageKey: string;
	stages: Array<{ key: string; name: string }>;
	items: ChecklistItemData[];
	members: Array<{ userId: string; userName: string | null }>;
	access: ProjectAccess;
	onSuccess: () => void;
}

export function ChecklistPanel({
	projectId,
	currentStageKey,
	stages,
	items,
	members,
	access,
	onSuccess,
}: ChecklistPanelProps) {
	const [isPending, startTransition] = useTransition();
	const [stageFilter, setStageFilter] = useState<string>(
		currentStageKey || "all",
	);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [itemToEdit, setItemToEdit] = useState<ChecklistItemData | null>(null);

	// Assessment for the active/current stage
	const currentStageItems = useMemo(
		() => items.filter((i) => i.stageKey === currentStageKey),
		[items, currentStageKey],
	);
	const assessment = useMemo(
		() => assessStageChecklist(currentStageItems),
		[currentStageItems],
	);

	const currentStageName =
		stages.find((s) => s.key === currentStageKey)?.name || currentStageKey;

	const filteredItems = useMemo(() => {
		if (stageFilter === "all") return items;
		return items.filter((i) => i.stageKey === stageFilter);
	}, [items, stageFilter]);

	const stagePills = useMemo(() => {
		return [
			{ value: "all", label: "All Stages" },
			...stages.map((s) => ({
				value: s.key,
				label: s.key === currentStageKey ? `${s.name} (Current)` : s.name,
			})),
		];
	}, [stages, currentStageKey]);

	const handleToggleStatus = (
		item: ChecklistItemData,
		newStatus: "pending" | "done" | "not_applicable",
	) => {
		startTransition(async () => {
			try {
				const res = await toggleChecklistItem({
					data: {
						itemId: item.id,
						status: newStatus,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success(
						newStatus === "done"
							? "Checklist item completed"
							: newStatus === "not_applicable"
								? "Item marked as N/A"
								: "Item marked pending",
					);
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to update status");
			}
		});
	};

	const handleDelete = (itemId: string) => {
		startTransition(async () => {
			try {
				const res = await deleteChecklistItem({
					data: { itemId },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Checklist item removed");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to delete item");
			}
		});
	};

	return (
		<div className="space-y-6">
			{/* Current Stage Gate Assessment Summary */}
			<StageChecklistSummary
				totalCount={assessment.totalCount}
				completedCount={assessment.completedCount}
				requiredCount={assessment.requiredCount}
				requiredMetCount={assessment.requiredMetCount}
				percentComplete={assessment.percentComplete}
				currentStageName={currentStageName}
			/>

			{/* Standardized Toolbar */}
			<DataTableToolbar>
				<div className="flex items-center gap-1.5 overflow-x-auto">
					<div className="flex items-center rounded-lg bg-surface-alt p-0.5 border border-border/50">
						{stagePills.map((s) => (
							<button
								key={s.value}
								type="button"
								onClick={() => setStageFilter(s.value)}
								className={cn(
									"rounded-md px-2.5 py-1 text-xs font-medium transition-all",
									stageFilter === s.value
										? "bg-card text-foreground shadow-xs font-semibold"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{s.label}
							</button>
						))}
					</div>
				</div>

				<div className="flex items-center gap-2">
					{access.canContribute && (
						<Button
							size="sm"
							onClick={() => {
								setItemToEdit(null);
								setDialogOpen(true);
							}}
							className="h-8 text-xs gap-1.5"
						>
							<Plus className="size-3.5" />
							Add Checklist Item
						</Button>
					)}
				</div>
			</DataTableToolbar>

			{/* Checklist Items List */}
			{filteredItems.length === 0 ? (
				<div className="border border-dashed border-border p-12 text-center space-y-3">
					<CheckSquare className="size-9 text-muted-foreground mx-auto stroke-1" />
					<p className="text-sm font-medium text-foreground">
						No checklist items for this stage.
					</p>
					<p className="text-xs text-muted-foreground">
						Add checklist requirements or milestones for the team to complete.
					</p>
				</div>
			) : (
				<div className="space-y-2.5">
					{filteredItems.map((item) => (
						<ChecklistItemRow
							key={item.id}
							item={item}
							access={access}
							onToggleStatus={handleToggleStatus}
							onEdit={(i) => {
								setItemToEdit(i);
								setDialogOpen(true);
							}}
							onDelete={handleDelete}
							isPending={isPending}
						/>
					))}
				</div>
			)}

			{/* Create/Edit Item Modal */}
			<ChecklistItemDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				projectId={projectId}
				stages={stages}
				members={members}
				defaultStageKey={stageFilter !== "all" ? stageFilter : currentStageKey}
				itemToEdit={itemToEdit}
				onSuccess={onSuccess}
			/>
		</div>
	);
}
