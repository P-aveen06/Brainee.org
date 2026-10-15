"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StageChecklistSummaryProps {
	totalCount: number;
	completedCount: number;
	requiredCount: number;
	requiredMetCount: number;
	percentComplete: number;
	currentStageName?: string;
	className?: string;
}

export function StageChecklistSummary({
	totalCount,
	completedCount,
	requiredCount,
	requiredMetCount,
	percentComplete,
	currentStageName,
	className,
}: StageChecklistSummaryProps) {
	const pendingRequired = requiredCount - requiredMetCount;

	return (
		<div
			className={cn(
				"space-y-3 rounded-xl border border-border bg-card p-4",
				className,
			)}
		>
			<div className="flex items-center justify-between">
				<div>
					<h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
						{currentStageName
							? `${currentStageName} Stage Checklist`
							: "Stage Checklist"}
					</h4>
					<p className="text-xs text-muted-foreground mt-0.5">
						{completedCount} of {totalCount} items completed ({percentComplete}
						%)
					</p>
				</div>

				<div className="text-right">
					<span className="font-mono text-sm font-bold text-primary">
						{percentComplete}%
					</span>
				</div>
			</div>

			{/* Linear Progress Bar */}
			<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
				<div
					className="h-full rounded-full bg-accent-gradient transition-all duration-300"
					style={{ width: `${percentComplete}%` }}
				/>
			</div>

			{/* Required Gates Status Notice */}
			{requiredCount > 0 && (
				<div
					className={cn(
						"flex items-center gap-2 rounded-lg border p-2.5 text-xs",
						pendingRequired > 0
							? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
							: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
					)}
				>
					{pendingRequired > 0 ? (
						<>
							<AlertCircle className="size-4 shrink-0 text-amber-500" />
							<span>
								<strong>{pendingRequired} required</strong> checklist item
								{pendingRequired === 1 ? "" : "s"} must be completed before
								advancing to the next stage.
							</span>
						</>
					) : (
						<>
							<CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
							<span>
								All required stage checklist items satisfied. Stage may advance.
							</span>
						</>
					)}
				</div>
			)}
		</div>
	);
}
