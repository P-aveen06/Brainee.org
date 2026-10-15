"use client";

import { AlertCircle, Bell, CheckCircle2, Clock, FileText } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { generateEodReport, remindMissingSubmitters } from "@/api/project-eod";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EodSubmissionState } from "@/lib/eod-policy";
import type { ProjectAccess } from "@/lib/project-access";

interface EodStatusPanelProps {
	projectId: string;
	date: string;
	submissionState: EodSubmissionState;
	access: ProjectAccess;
	onSuccess: () => void;
}

export function EodStatusPanel({
	projectId,
	date,
	submissionState,
	access,
	onSuccess,
}: EodStatusPanelProps) {
	const [isPending, startTransition] = useTransition();

	const handleRemind = () => {
		startTransition(async () => {
			try {
				const res = await remindMissingSubmitters({
					data: { projectId, date },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					const count = "remindedCount" in res ? res.remindedCount : 0;
					toast.success(
						`Reminder sent to ${count} missing team member(s) via in-app notifications.`,
					);
				}
			} catch (_err) {
				toast.error("Failed to send reminders.");
			}
		});
	};

	const handleGenerate = () => {
		startTransition(async () => {
			try {
				const res = await generateEodReport({
					data: { projectId, date },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("EOD report generated successfully!");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to generate EOD report.");
			}
		});
	};

	return (
		<div className="border border-border bg-card p-4 space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<h4 className="font-heading text-sm font-semibold text-foreground">
							Daily Standup Submission Status
						</h4>
						{submissionState.allSubmitted ? (
							<Badge
								variant="default"
								className="bg-emerald-600 text-[10px] gap-1"
							>
								<CheckCircle2 className="size-3" />
								All Submitted
							</Badge>
						) : (
							<Badge
								variant="outline"
								className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 gap-1"
							>
								<Clock className="size-3" />
								{submissionState.missing.length} Missing
							</Badge>
						)}
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						{submissionState.submitted.length} of{" "}
						{submissionState.expected.length} expected contributors submitted.
						(Viewers excluded).
					</p>
				</div>

				<div className="flex items-center gap-2">
					{!submissionState.allSubmitted && access.canContribute && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleRemind}
							disabled={isPending || submissionState.missing.length === 0}
							className="h-8 text-xs"
						>
							<Bell className="mr-1.5 size-3.5" />
							Remind Missing ({submissionState.missing.length})
						</Button>
					)}

					{access.canContribute && (
						<Button
							size="sm"
							onClick={handleGenerate}
							disabled={isPending || !submissionState.canGenerate}
							className="h-8 text-xs"
						>
							<FileText className="mr-1.5 size-3.5" />
							{submissionState.allSubmitted
								? "Generate EOD Report"
								: "Generate Anyway (Override)"}
						</Button>
					)}
				</div>
			</div>

			{/* Submitter breakdown */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
				{/* Submitted */}
				<div className="space-y-1.5">
					<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
						<CheckCircle2 className="size-3 text-emerald-600" />
						Submitted Contributors ({submissionState.submitted.length})
					</span>
					<div className="flex flex-wrap gap-1.5">
						{submissionState.expected
							.filter((e) => submissionState.submitted.includes(e.userId))
							.map((m) => (
								<Badge
									key={m.userId}
									variant="secondary"
									className="text-xs font-normal gap-1 py-1"
								>
									<Avatar className="size-4">
										<AvatarFallback className="text-[9px]">
											{m.name.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span>{m.name}</span>
								</Badge>
							))}
						{submissionState.submitted.length === 0 && (
							<span className="text-xs text-muted-foreground italic">
								None yet for this date.
							</span>
						)}
					</div>
				</div>

				{/* Missing */}
				<div className="space-y-1.5">
					<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
						<AlertCircle className="size-3 text-amber-500" />
						Awaiting Submission ({submissionState.missing.length})
					</span>
					<div className="flex flex-wrap gap-1.5">
						{submissionState.missing.map((m) => (
							<Badge
								key={m.userId}
								variant="outline"
								className="text-xs font-normal border-amber-500/30 text-amber-700 dark:text-amber-400 gap-1 py-1"
							>
								<Avatar className="size-4">
									<AvatarFallback className="text-[9px]">
										{m.name.slice(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span>{m.name}</span>
							</Badge>
						))}
						{submissionState.missing.length === 0 && (
							<span className="text-xs text-emerald-600 font-medium">
								All team members have logged!
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
