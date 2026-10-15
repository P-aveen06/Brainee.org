"use client";

import { CheckCircle2, Circle, Clock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface OpenTaskOption {
	id: string;
	taskNumber: number;
	title: string;
	status: string;
}

export interface UpdateItemDraft {
	rowKey?: string;
	taskId: string;
	note?: string;
	progressNote?: string;
}

interface DailyUpdateItemRowProps {
	index: number;
	item: UpdateItemDraft;
	openTasks: OpenTaskOption[];
	onChange: (updated: UpdateItemDraft) => void;
	onRemove: () => void;
}

function getStatusBadge(status?: string) {
	switch (status) {
		case "done":
			return (
				<Badge variant="success" className="text-[10px] px-1.5 py-0 h-4">
					<CheckCircle2 className="mr-0.5 size-2.5" /> Done
				</Badge>
			);
		case "in_progress":
			return (
				<Badge variant="accent" className="text-[10px] px-1.5 py-0 h-4">
					<Clock className="mr-0.5 size-2.5" /> In Progress
				</Badge>
			);
		case "blocked":
			return (
				<Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
					Blocked
				</Badge>
			);
		default:
			return (
				<Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
					<Circle className="mr-0.5 size-2.5" /> Todo
				</Badge>
			);
	}
}

export function DailyUpdateItemRow({
	item,
	openTasks,
	onChange,
	onRemove,
}: DailyUpdateItemRowProps) {
	const selectedTask = openTasks.find((t) => t.id === item.taskId);

	return (
		<div className="rounded-xl border border-border/80 bg-card/60 p-3.5 sm:p-4 shadow-xs space-y-3 transition-all hover:border-border">
			{/* Top Bar: Task selector with label and remove button */}
			<div className="space-y-1.5">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Label className="text-xs font-semibold text-foreground/80">
							Linked Task
						</Label>
						{selectedTask && getStatusBadge(selectedTask.status)}
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-7"
						onClick={onRemove}
						title="Remove this task link"
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>

				<Select
					value={item.taskId}
					onValueChange={(taskId) => {
						if (taskId) onChange({ ...item, taskId });
					}}
				>
					<SelectTrigger className="h-9 text-xs bg-background">
						<SelectValue placeholder="Select a task worked on...">
							{selectedTask
								? `#${selectedTask.taskNumber} ${selectedTask.title}`
								: "Select a task..."}
						</SelectValue>
					</SelectTrigger>
					<SelectContent className="max-h-60">
						{openTasks.map((t) => (
							<SelectItem key={t.id} value={t.id} className="text-xs py-2">
								<div className="flex items-center justify-between gap-3 w-full">
									<span className="font-medium truncate max-w-[340px]">
										#{t.taskNumber} {t.title}
									</span>
									<span className="text-[10px] text-muted-foreground uppercase shrink-0">
										{t.status}
									</span>
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Bottom Bar: Detailed Work Note & Status/Progress */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
				<div className="space-y-1">
					<Label className="text-[11px] font-medium text-muted-foreground">
						Activity Note (Optional)
					</Label>
					<Input
						value={item.note || ""}
						onChange={(e) => onChange({ ...item, note: e.target.value })}
						placeholder="e.g. Implemented OAuth callback handler..."
						className="h-8 text-xs bg-background"
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-[11px] font-medium text-muted-foreground">
						Progress / Completion Note (Optional)
					</Label>
					<Input
						value={item.progressNote || ""}
						onChange={(e) =>
							onChange({ ...item, progressNote: e.target.value })
						}
						placeholder="e.g. 80% complete, waiting on PR review..."
						className="h-8 text-xs bg-background"
					/>
				</div>
			</div>
		</div>
	);
}
