"use client";

import { AlertTriangle } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { formatDateDisplay } from "@/lib/date-format";
import { TASK_STATUS_CONFIG } from "./taskStatusStyles";

interface TaskStatusBannersProps {
	status: string;
	blockedReason?: string | null;
	dueDate?: string | null;
	isOverdue: boolean;
	canContribute: boolean;
	isPending: boolean;
	onStatusChange: (v: string | null) => void;
}

export function TaskStatusBanners({
	status,
	blockedReason,
	dueDate,
	isOverdue,
	canContribute,
	isPending,
	onStatusChange,
}: TaskStatusBannersProps) {
	return (
		<div className="space-y-3">
			{/* Quick Status Selector */}
			{canContribute && (
				<div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-surface p-3 text-xs">
					<span className="text-[11px] font-medium text-muted-foreground">
						Current Status:
					</span>
					<Select
						value={status}
						onValueChange={onStatusChange}
						disabled={isPending}
					>
						<SelectTrigger className="h-9 w-full bg-background">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(TASK_STATUS_CONFIG).map(([key, cfg]) => (
								<SelectItem key={key} value={key}>
									{cfg.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			{/* Blocked Reason Callout */}
			{status === "blocked" && blockedReason && (
				<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
					<AlertTriangle className="size-4 shrink-0 mt-0.5" />
					<div>
						<p className="font-semibold">Blocked</p>
						<p className="mt-0.5 leading-relaxed">{blockedReason}</p>
					</div>
				</div>
			)}

			{/* Overdue Banner */}
			{isOverdue && (
				<div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
					<AlertTriangle className="size-4 shrink-0" />
					<span>
						This task was due on{" "}
						<strong className="font-semibold">
							{formatDateDisplay(dueDate)}
						</strong>{" "}
						and is overdue.
					</span>
				</div>
			)}
		</div>
	);
}
