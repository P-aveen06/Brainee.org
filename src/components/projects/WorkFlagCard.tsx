"use client";

import { Check, Clock, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateDisplay } from "@/lib/date-format";
import { getTodayIsoDate } from "@/lib/leave-policy";
import { WorkFlagBadge } from "./WorkFlagBadge";

export interface WorkFlagItemData {
	id: string;
	projectId: string;
	entityType: string;
	entityId: string;
	flagCode: string;
	severity: string;
	message: string;
	evidence: string | null;
	source: string;
	status: string;
	raisedForUserId: string | null;
	raisedForUserName: string | null;
	createdAt: Date | null;
}

interface WorkFlagCardProps {
	flag: WorkFlagItemData;
	canManage: boolean;
	currentUserId?: string;
	isPending: boolean;
	onAcknowledge: (flagId: string) => void;
	onDismiss: (flagId: string) => void;
}

export function WorkFlagCard({
	flag,
	canManage,
	currentUserId,
	isPending,
	onAcknowledge,
	onDismiss,
}: WorkFlagCardProps) {
	const isTargetUser = flag.raisedForUserId === currentUserId;
	const canAct = canManage || isTargetUser;
	const isOpen = flag.status === "open";

	let evidenceObj: Record<string, unknown> | null = null;
	if (flag.evidence) {
		try {
			evidenceObj = JSON.parse(flag.evidence);
		} catch {
			evidenceObj = null;
		}
	}

	return (
		<div className="border border-border bg-card p-4 space-y-3">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-2 flex-wrap">
					<WorkFlagBadge flagCode={flag.flagCode} severity={flag.severity} />
					<Badge variant="outline" className="text-[10px] uppercase">
						{flag.entityType.replace(/_/g, " ")}
					</Badge>
					<span className="text-[11px] text-muted-foreground flex items-center gap-1">
						<Clock className="size-3" />
						{flag.createdAt
							? formatDateDisplay(getTodayIsoDate(flag.createdAt))
							: "—"}
					</span>
					{flag.source === "ai" && (
						<Badge
							variant="secondary"
							className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
						>
							AI Observation
						</Badge>
					)}
				</div>

				<Badge
					variant={
						flag.status === "open"
							? "default"
							: flag.status === "acknowledged"
								? "outline"
								: "secondary"
					}
					className="text-[10px] capitalize"
				>
					{flag.status}
				</Badge>
			</div>

			<p className="text-xs text-foreground font-medium leading-relaxed">
				{flag.message}
			</p>

			{/* Evidence Detail Drawer */}
			{evidenceObj && Object.keys(evidenceObj).length > 0 && (
				<div className="border border-border/60 bg-muted/30 p-2.5 text-[11px] space-y-1">
					<span className="font-semibold text-muted-foreground uppercase text-[9px] tracking-wider block">
						Evidence & Context
					</span>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
						{Object.entries(evidenceObj).map(([k, v]) => (
							<div key={k} className="space-y-0.5">
								<span className="text-muted-foreground text-[10px] capitalize">
									{k.replace(/([A-Z])/g, " $1")}
								</span>
								<p className="font-mono text-xs text-foreground font-medium">
									{String(v)}
								</p>
							</div>
						))}
					</div>
				</div>
			)}

			<div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
				<span className="text-muted-foreground text-[11px]">
					{flag.raisedForUserName
						? `Work item of: ${flag.raisedForUserName}`
						: "Unassigned work item"}
				</span>

				{isOpen && canAct && (
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="h-7 text-xs"
							onClick={() => onAcknowledge(flag.id)}
							disabled={isPending}
						>
							<Check className="mr-1 size-3" />
							Acknowledge
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs text-muted-foreground hover:text-foreground"
							onClick={() => onDismiss(flag.id)}
							disabled={isPending}
						>
							<EyeOff className="mr-1 size-3" />
							Dismiss
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
