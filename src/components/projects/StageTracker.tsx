"use client";

import { Check, ChevronRight, Play } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { advanceProjectStage } from "@/api/projects";
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
import { cn } from "@/lib/utils";

export interface Stage {
	id: string;
	key: string;
	name: string;
	sequence: number;
}

export interface StageProgress {
	stageKey: string;
	status: string;
	startedAt?: Date | null;
	completedAt?: Date | null;
	notes?: string | null;
}

interface StageTrackerProps {
	projectId: string;
	stages: Stage[];
	progress: StageProgress[];
	currentStageKey?: string | null;
	canManage: boolean;
	onSuccess: () => void;
}

export function StageTracker({
	projectId,
	stages,
	progress,
	currentStageKey,
	canManage,
	onSuccess,
}: StageTrackerProps) {
	const [isPending, startTransition] = useTransition();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [advanceNotes, setAdvanceNotes] = useState("");

	const progressMap = new Map(progress.map((p) => [p.stageKey, p]));
	const currentIndex = stages.findIndex(
		(s) => s.key === (currentStageKey || "planning"),
	);
	const nextStage =
		currentIndex >= 0 && currentIndex < stages.length - 1
			? stages[currentIndex + 1]
			: null;

	const handleAdvance = () => {
		startTransition(async () => {
			try {
				const res = await advanceProjectStage({
					data: {
						projectId,
						targetStageKey: nextStage?.key,
						notes: advanceNotes.trim() || null,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
					return;
				}

				const stageName =
					"newStageName" in res ? res.newStageName : nextStage?.name;
				toast.success(
					`Advanced project stage to ${stageName || "next stage"}.`,
				);
				setDialogOpen(false);
				setAdvanceNotes("");
				onSuccess();
			} catch (_err) {
				toast.error("Failed to advance stage.");
			}
		});
	};

	return (
		<div className="rounded-xl bg-surface p-4 sm:p-5">
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">
						Lifecycle Stage Progress
					</h3>
					<p className="text-xs text-muted-foreground mt-0.5">
						Current:{" "}
						<span className="font-medium text-foreground capitalize">
							{currentStageKey || "planning"}
						</span>
						{nextStage && (
							<span>
								{" "}
								• Next:{" "}
								<span className="font-medium text-muted-foreground">
									{nextStage.name}
								</span>
							</span>
						)}
					</p>
				</div>

				{canManage && nextStage && (
					<Button
						size="sm"
						variant="default"
						onClick={() => setDialogOpen(true)}
						disabled={isPending}
					>
						<Play className="mr-1.5 size-3.5 fill-current" />
						Advance to {nextStage.name}
					</Button>
				)}
			</div>

			{/* Stepper visual */}
			<div className="mt-4 overflow-x-auto rounded-lg bg-card px-3 py-3">
				<div className="flex items-center min-w-max gap-2 sm:gap-3">
					{stages.map((stage, idx) => {
						const prog = progressMap.get(stage.key);
						const isCompleted =
							prog?.status === "completed" || idx < currentIndex;
						const isActive = stage.key === (currentStageKey || "planning");

						return (
							<div key={stage.key} className="flex items-center">
								<div className="flex items-center gap-2.5">
									<div
										className={cn(
											"flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold border transition-all",
											isCompleted
												? "border-primary bg-primary text-primary-foreground"
												: isActive
													? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
													: "border-border bg-muted/50 text-muted-foreground",
										)}
									>
										{isCompleted ? (
											<Check className="size-3.5 stroke-[2.5]" />
										) : (
											<span>{stage.sequence}</span>
										)}
									</div>
									<div className="flex flex-col">
										<span
											className={cn(
												"text-xs font-medium leading-none",
												isActive
													? "text-primary font-semibold"
													: isCompleted
														? "text-foreground"
														: "text-muted-foreground",
											)}
										>
											{stage.name}
										</span>
										<span className="text-[10px] text-muted-foreground mt-0.5 capitalize">
											{isActive
												? "In Progress"
												: isCompleted
													? "Done"
													: "Upcoming"}
										</span>
									</div>
								</div>

								{idx < stages.length - 1 && (
									<ChevronRight className="mx-2 sm:mx-3 size-4 text-muted-foreground/50 shrink-0" />
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Advance stage confirmation dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Advance Project Stage</DialogTitle>
						<DialogDescription>
							Move project from{" "}
							<span className="font-semibold text-foreground capitalize">
								{currentStageKey}
							</span>{" "}
							to{" "}
							<span className="font-semibold text-primary">
								{nextStage?.name}
							</span>
							.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 py-2">
						<label
							htmlFor="stageNotes"
							className="text-xs font-medium text-foreground"
						>
							Transition Summary / Notes (optional)
						</label>
						<Textarea
							id="stageNotes"
							placeholder="e.g. Scope agreed with client, kick-off scheduled..."
							rows={3}
							value={advanceNotes}
							onChange={(e) => setAdvanceNotes(e.target.value)}
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setDialogOpen(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button onClick={handleAdvance} disabled={isPending}>
							{isPending
								? "Advancing..."
								: `Confirm Advance to ${nextStage?.name}`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
