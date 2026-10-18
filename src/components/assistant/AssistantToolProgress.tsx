"use client";

import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	Circle,
	LoaderCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	ASSISTANT_TOOL_STEP_LABELS,
	type AssistantToolProgress as AssistantToolProgressState,
} from "@/lib/ai/assistant-activity";

export function AssistantToolProgress({
	steps,
	isRunning,
}: {
	steps: AssistantToolProgressState[];
	isRunning: boolean;
}) {
	const [open, setOpen] = useState(isRunning);
	const completedCount = steps.filter(
		(step) => step.status === "complete",
	).length;
	const hasFailed = steps.some((step) => step.status === "failed");
	const summary = isRunning
		? "Assistant activity"
		: hasFailed
			? "Some checks need attention"
			: completedCount === steps.length
				? `${completedCount} ${completedCount === 1 ? "area" : "areas"} reviewed`
				: "Activity details";

	useEffect(() => setOpen(isRunning), [isRunning]);

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<div className="w-fit max-w-full rounded-lg border border-border/60 bg-surface-alt/50 text-xs text-muted-foreground">
				<CollapsibleTrigger
					className="flex min-h-8 w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
					aria-label={`${open ? "Hide" : "Show"} assistant activity`}
				>
					{isRunning ? (
						<LoaderCircle className="size-3.5 shrink-0 animate-spin text-accent" />
					) : hasFailed ? (
						<AlertCircle className="size-3.5 shrink-0 text-destructive" />
					) : (
						<CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
					)}
					<span className="truncate">{summary}</span>
					<ChevronDown
						aria-hidden="true"
						className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
					/>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<ol className="space-y-1 border-t border-border/50 px-2.5 py-2">
						{steps.map((step) => (
							<li key={step.step} className="flex items-center gap-2 leading-5">
								{step.status === "complete" ? (
									<CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
								) : step.status === "failed" ? (
									<AlertCircle className="size-3.5 shrink-0 text-destructive" />
								) : step.status === "running" ? (
									<LoaderCircle className="size-3.5 shrink-0 animate-spin text-accent" />
								) : (
									<Circle className="size-3.5 shrink-0 text-muted-foreground/60" />
								)}
								<span>{ASSISTANT_TOOL_STEP_LABELS[step.step]}</span>
							</li>
						))}
					</ol>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}
