"use client";

import {
	Check,
	CheckCircle2,
	Loader2,
	Plus,
	Save,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	confirmMultipleAiTasks,
	getMyDailyUpdate,
	previewTaskFromDailySummary,
	saveDailyUpdate,
} from "@/api/project-daily-updates";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
	DailyUpdateItemRow,
	type OpenTaskOption,
	type UpdateItemDraft,
} from "./DailyUpdateItemRow";

interface DailyUpdateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	projectCode: string;
	projectName: string;
	date: string;
	onSuccess: () => void;
}

interface PreviewTaskItem {
	id: string;
	title: string;
	status: "todo" | "in_progress" | "done" | "blocked";
	description?: string;
	selected: boolean;
}

export function DailyUpdateDialog({
	open,
	onOpenChange,
	projectId,
	projectCode,
	projectName,
	date,
	onSuccess,
}: DailyUpdateDialogProps) {
	const [isPending, startTransition] = useTransition();

	const [summary, setSummary] = useState("");
	const [blockers, setBlockers] = useState("");
	const [hoursSpent, setHoursSpent] = useState("");
	const [items, setItems] = useState<UpdateItemDraft[]>([]);
	const [openTasks, setOpenTasks] = useState<OpenTaskOption[]>([]);
	const [_isLoading, setIsLoading] = useState(false);
	const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
	const [aiPreviews, setAiPreviews] = useState<PreviewTaskItem[]>([]);
	const [isConfirmingTasks, setIsConfirmingTasks] = useState(false);
	const abortControllerRef = useRef<AbortController | null>(null);

	const handleCancelAiPreview = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		setIsGeneratingPreview(false);
		toast.info("AI analysis cancelled.");
	};

	useEffect(() => {
		if (!open) {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
				abortControllerRef.current = null;
			}
			setIsGeneratingPreview(false);
			setAiPreviews([]);
			return;
		}

		let active = true;
		setIsLoading(true);

		getMyDailyUpdate({ data: { projectId, date } })
			.then((res) => {
				if (!active) return;
				if ("error" in res && res.error) {
					toast.error(String(res.error));
					return;
				}

				if (res.myOpenTasks) {
					setOpenTasks(res.myOpenTasks);
				}

				if (res.update) {
					setSummary(res.update.summary || "");
					setBlockers(res.update.blockers || "");
					setHoursSpent(
						res.update.hoursSpent != null ? String(res.update.hoursSpent) : "",
					);
					if (res.items) {
						setItems(
							res.items.map((i) => ({
								taskId: i.taskId,
								note: i.note || "",
								progressNote: i.progressNote || "",
							})),
						);
					}
				} else {
					setSummary("");
					setBlockers("");
					setHoursSpent("");
					setItems([]);
				}
			})
			.catch((err) => {
				if (!active) return;
				console.error("Failed to load daily update:", err);
				toast.error("Failed to load today's update data.");
			})
			.finally(() => {
				if (active) setIsLoading(false);
			});

		return () => {
			active = false;
		};
	}, [open, projectId, date]);

	const handleAddItem = () => {
		const available = openTasks.find(
			(ot) => !items.some((i) => i.taskId === ot.id),
		);
		const taskId = available?.id || openTasks[0]?.id || "";
		if (!taskId) {
			toast.info("No open tasks available to link.");
			return;
		}
		setItems([...items, { taskId, note: "", progressNote: "" }]);
	};

	const handlePreviewAiTask = async () => {
		if (!summary.trim()) {
			toast.error(
				"Please enter a summary of your work first so AI can suggest tasks.",
			);
			return;
		}

		const controller = new AbortController();
		abortControllerRef.current = controller;
		setIsGeneratingPreview(true);
		try {
			const res = await previewTaskFromDailySummary({
				data: {
					projectId,
					summary: summary.trim(),
					blockers: blockers.trim() || undefined,
				},
			});

			if (controller.signal.aborted) {
				return;
			}

			if ("error" in res && res.error) {
				toast.error(String(res.error));
			} else if (res.tasks && res.tasks.length > 0) {
				setAiPreviews(
					res.tasks.map((t, idx) => ({
						id: `preview-${Date.now()}-${idx}`,
						title: t.title,
						status: t.status,
						description: t.description,
						selected: true,
					})),
				);
			} else {
				toast.info("No discrete tasks detected from the summary.");
			}
		} catch (_err: unknown) {
			if (controller.signal.aborted) {
				return;
			}
			toast.error("Failed to generate AI task preview.");
		} finally {
			if (abortControllerRef.current === controller) {
				abortControllerRef.current = null;
				setIsGeneratingPreview(false);
			}
		}
	};

	const handleConfirmAiTasks = async () => {
		const selected = aiPreviews.filter((p) => p.selected && p.title.trim());
		if (selected.length === 0) {
			toast.info("Please select at least one task to create.");
			return;
		}

		setIsConfirmingTasks(true);
		try {
			const res = await confirmMultipleAiTasks({
				data: {
					projectId,
					date,
					tasks: selected.map((p) => ({
						title: p.title.trim(),
						status: p.status,
						description: p.description || p.title.trim(),
					})),
				},
			});

			if ("error" in res && res.error) {
				toast.error(String(res.error));
			} else if (res.tasks && res.tasks.length > 0) {
				const createdOptions: OpenTaskOption[] = res.tasks.map((t) => ({
					id: t.id,
					taskNumber: t.taskNumber,
					title: t.title,
					status: t.status,
				}));

				setOpenTasks((prev) => [...createdOptions, ...prev]);
				setItems((prev) => [
					...prev,
					...createdOptions.map((t) => ({
						taskId: t.id,
						note: t.title,
						progressNote: "",
					})),
				]);

				setAiPreviews([]);
				toast.success(
					`Created & linked ${createdOptions.length} ${createdOptions.length === 1 ? "task" : "tasks"}!`,
				);
			}
		} catch (_err) {
			toast.error("Failed to create confirmed tasks.");
		} finally {
			setIsConfirmingTasks(false);
		}
	};

	const handleItemChange = (index: number, updated: UpdateItemDraft) => {
		const next = [...items];
		next[index] = updated;
		setItems(next);
	};

	const handleItemRemove = (index: number) => {
		setItems(items.filter((_, i) => i !== index));
	};

	const handleSave = (status: "draft" | "submitted") => {
		if (!summary.trim()) {
			toast.error("Please provide a summary of what you worked on.");
			return;
		}

		startTransition(async () => {
			try {
				const res = await saveDailyUpdate({
					data: {
						projectId,
						date,
						summary: summary.trim(),
						blockers: blockers.trim() || undefined,
						hoursSpent: hoursSpent ? Number(hoursSpent) : undefined,
						status,
						autoCreateTask: false, // Do not silently create unexpected tasks
						items: items.map((i) => ({
							taskId: i.taskId,
							note: i.note?.trim() || undefined,
							progressNote: i.progressNote?.trim() || undefined,
						})),
					},
				});

				if ("error" in res && res.error) {
					toast.error(String(res.error));
				} else {
					toast.success(
						status === "submitted"
							? "Daily update submitted!"
							: "Draft update saved.",
					);
					onOpenChange(false);
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to save daily update.");
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl h-[88vh] max-h-[850px] flex flex-col p-0 overflow-hidden gap-0">
				{/* FIXED HEADER */}
				<DialogHeader className="shrink-0 px-6 py-4 border-b border-border bg-card">
					<DialogTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
						Daily Standup Update
						<Badge variant="outline" className="font-mono text-xs">
							{projectCode}
						</Badge>
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						{projectName} · Date:{" "}
						<strong className="text-foreground font-medium">{date}</strong>
					</DialogDescription>
				</DialogHeader>

				{/* SCROLLABLE BODY */}
				<div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
					{/* 1. TOP SECTION: Summary of Accomplishments */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label
								htmlFor="dailySummary"
								className="text-xs font-semibold uppercase tracking-wider text-foreground/80"
							>
								Summary of Work <span className="text-destructive">*</span>
							</Label>
							<span className="text-[11px] text-muted-foreground">
								What did you build, review, or deliver today?
							</span>
						</div>
						<Textarea
							id="dailySummary"
							value={summary}
							onChange={(e) => setSummary(e.target.value)}
							placeholder="e.g. Worked on login page, fixed bugs on home page, and tested download feature..."
							rows={3}
							required
							className="resize-y min-h-[84px] text-xs leading-relaxed focus-visible:ring-1"
						/>

						{/* Action toolbar right below the summary */}
						<div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
							<div className="flex items-center gap-2">
								{isGeneratingPreview ? (
									<div className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1">
										<Loader2 className="size-3.5 animate-spin text-purple-600 dark:text-purple-400" />
										<span className="text-xs font-medium text-purple-700 dark:text-purple-300">
											Analyzing work summary...
										</span>
										<Button
											type="button"
											variant="ghost"
											size="xs"
											className="h-5 px-1.5 ml-1 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 font-semibold"
											onClick={handleCancelAiPreview}
											title="Cancel AI analysis"
										>
											<X className="mr-0.5 size-3" />
											Cancel
										</Button>
									</div>
								) : (
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8 text-xs border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 font-medium transition-all"
										onClick={handlePreviewAiTask}
										disabled={!summary.trim()}
										title="Analyze your work summary and suggest tasks for preview"
									>
										<Sparkles className="mr-1.5 size-3.5 text-purple-600 dark:text-purple-400" />
										Generate Tasks with AI
									</Button>
								)}

								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 text-xs"
									onClick={handleAddItem}
									disabled={openTasks.length === 0}
								>
									<Plus className="mr-1.5 size-3.5" />
									Link Existing Task
								</Button>
							</div>

							<span className="text-[11px] text-muted-foreground">
								{summary.trim().length > 0
									? `${summary.trim().length} characters`
									: "Enter summary above"}
							</span>
						</div>
					</div>

					{/* 2. AI MULTI-TASK PREVIEWS CONFIRMATION CARD (Shows when preview tasks are ready) */}
					{aiPreviews.length > 0 && (
						<div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3.5 animate-in fade-in-50 duration-200">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div className="size-6 rounded-full bg-purple-500/20 flex items-center justify-center">
										<Sparkles className="size-3.5 text-purple-600 dark:text-purple-400" />
									</div>
									<span className="text-xs font-semibold text-foreground">
										AI Suggested Tasks ({aiPreviews.length})
									</span>
									<Badge
										variant="outline"
										className="text-[10px] uppercase font-mono px-2 py-0.5 border-purple-500/30 text-purple-700 dark:text-purple-300"
									>
										{aiPreviews.filter((p) => p.selected).length} selected
									</Badge>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									className="size-6 text-muted-foreground hover:text-foreground"
									onClick={() => setAiPreviews([])}
									title="Dismiss previews"
								>
									<X className="size-3.5" />
								</Button>
							</div>

							<p className="text-[11px] text-muted-foreground">
								AI detected multiple distinct tasks. Review, edit titles, and
								select which ones to add to your project tasks:
							</p>

							<div className="space-y-2.5">
								{aiPreviews.map((preview, index) => (
									<div
										key={preview.id}
										className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card p-2.5 shadow-2xs transition-colors"
									>
										<Checkbox
											id={`ai-task-${preview.id}`}
											checked={preview.selected}
											onCheckedChange={(checked) => {
												const next = [...aiPreviews];
												next[index] = {
													...preview,
													selected: Boolean(checked),
												};
												setAiPreviews(next);
											}}
										/>
										<div className="flex-1 min-w-0">
											<Input
												value={preview.title}
												onChange={(e) => {
													const next = [...aiPreviews];
													next[index] = { ...preview, title: e.target.value };
													setAiPreviews(next);
												}}
												placeholder="Task title..."
												className="h-8 text-xs bg-background font-medium"
											/>
										</div>
										<Badge
											variant={
												preview.status === "done"
													? "success"
													: preview.status === "in_progress"
														? "accent"
														: "outline"
											}
											className="text-[10px] uppercase font-mono px-2 py-0.5 shrink-0"
										>
											{preview.status}
										</Badge>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											className="size-7 text-muted-foreground hover:text-destructive shrink-0"
											onClick={() => {
												setAiPreviews(aiPreviews.filter((_, i) => i !== index));
											}}
											title="Remove suggestion"
										>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
								))}
							</div>

							<div className="flex items-center justify-between gap-2 pt-1 border-t border-purple-500/20">
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 text-[11px] text-muted-foreground"
										onClick={() => {
											const allSelected = aiPreviews.every((p) => p.selected);
											setAiPreviews(
												aiPreviews.map((p) => ({
													...p,
													selected: !allSelected,
												})),
											);
										}}
									>
										{aiPreviews.every((p) => p.selected)
											? "Deselect All"
											: "Select All"}
									</Button>
								</div>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 text-xs text-muted-foreground"
										onClick={() => setAiPreviews([])}
										disabled={isConfirmingTasks}
									>
										Cancel
									</Button>
									<Button
										type="button"
										size="sm"
										className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
										onClick={handleConfirmAiTasks}
										disabled={
											isConfirmingTasks ||
											aiPreviews.filter((p) => p.selected && p.title.trim())
												.length === 0
										}
									>
										{isConfirmingTasks ? (
											<Loader2 className="mr-1.5 size-3 animate-spin" />
										) : (
											<CheckCircle2 className="mr-1.5 size-3" />
										)}
										{isConfirmingTasks
											? "Creating Tasks..."
											: `Confirm & Add (${aiPreviews.filter((p) => p.selected && p.title.trim()).length})`}
									</Button>
								</div>
							</div>
						</div>
					)}

					{/* 3. LINKED TASKS SECTION */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Linked Tasks ({items.length})
							</Label>
							<span className="text-[11px] text-muted-foreground">
								{items.length === 0
									? "No tasks linked"
									: `${items.length} task${items.length > 1 ? "s" : ""} linked today`}
							</span>
						</div>

						{items.length === 0 ? (
							<div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-center text-xs text-muted-foreground space-y-1">
								<p className="font-medium text-foreground/80">
									No tasks linked yet
								</p>
								<p className="text-[11px] text-muted-foreground max-w-md mx-auto">
									Use the <strong>"Generate Tasks with AI"</strong> button above
									to detect and link discrete tasks from your work summary, or{" "}
									<strong>"Link Existing Task"</strong> to associate an open
									backlog task.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{items.map((item, idx) => (
									<DailyUpdateItemRow
										key={
											item.rowKey ||
											item.taskId ||
											`item-row-${item.note?.slice(0, 10)}`
										}
										index={idx}
										item={item}
										openTasks={openTasks}
										onChange={(updated) => handleItemChange(idx, updated)}
										onRemove={() => handleItemRemove(idx)}
									/>
								))}
							</div>
						)}
					</div>

					{/* 4. BOTTOM SECTION: Blockers & Hours */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/40">
						<div className="sm:col-span-2 space-y-1.5">
							<Label
								htmlFor="dailyBlockers"
								className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
							>
								Blockers / Impediments (Optional)
							</Label>
							<Textarea
								id="dailyBlockers"
								value={blockers}
								onChange={(e) => setBlockers(e.target.value)}
								placeholder="e.g. Waiting on API response specifications, pending client access..."
								rows={2}
								className="resize-y min-h-[64px] text-xs leading-relaxed"
							/>
						</div>

						<div className="space-y-1.5">
							<Label
								htmlFor="hoursSpent"
								className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
							>
								Hours Spent
							</Label>
							<Input
								id="hoursSpent"
								type="number"
								step="0.25"
								min="0"
								max="24"
								value={hoursSpent}
								onChange={(e) => setHoursSpent(e.target.value)}
								placeholder="e.g. 7.5"
								className="h-9 text-xs"
							/>
							<p className="text-[10px] text-muted-foreground">
								Approx. total hours today
							</p>
						</div>
					</div>
				</div>

				{/* FIXED FOOTER CTAS */}
				<DialogFooter className="shrink-0 px-6 py-3.5 border-t border-border bg-surface-alt flex items-center justify-between sm:justify-between m-0">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="secondary"
							onClick={() => handleSave("draft")}
							disabled={isPending || !summary.trim()}
						>
							<Save className="mr-1.5 size-3.5" />
							Save Draft
						</Button>
						<Button
							type="button"
							onClick={() => handleSave("submitted")}
							disabled={isPending || !summary.trim()}
						>
							<Check className="mr-1.5 size-3.5" />
							Submit Update
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
