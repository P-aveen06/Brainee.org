"use client";

import { Check, Clock, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
	confirmAiProposedAction,
	rejectAiProposedAction,
} from "@/api/ai-assistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditableTaskProposal } from "./EditableTaskProposal";

export interface ProposedActionItem {
	id: string;
	actionType: string;
	targetEntityType: string;
	targetEntityId: string;
	payload: Record<string, unknown>;
	status:
		| "pending"
		| "executing"
		| "confirmed"
		| "rejected"
		| "expired"
		| "failed";
	confirmedAt?: string | null;
	expiresAt?: string | null;
}

interface ProposedActionCardProps {
	action: ProposedActionItem;
	onActionResolved?: () => void;
}

export function ProposedActionCard(props: ProposedActionCardProps) {
	if (props.action.actionType === "create_task" && props.action.payload.sourceTaskId)
		return <EditableTaskProposal {...props} />;
	return <StandardProposedActionCard {...props} />;
}

function StandardProposedActionCard({
	action,
	onActionResolved,
}: ProposedActionCardProps) {
	const [status, setStatus] = useState(action.status);
	const [isPending, startTransition] = useTransition();

	const handleConfirm = () => {
		startTransition(async () => {
			try {
				const res = await confirmAiProposedAction({
					data: { proposalId: action.id },
				});
				if ("error" in res && res.error) {
					toast.error(String(res.error));
				} else {
					setStatus("confirmed");
					toast.success("Action confirmed and executed successfully.");
					onActionResolved?.();
				}
			} catch (err: unknown) {
				toast.error(
					err instanceof Error ? err.message : "Failed to confirm action.",
				);
			}
		});
	};

	const handleReject = () => {
		startTransition(async () => {
			try {
				const res = await rejectAiProposedAction({
					data: { proposalId: action.id },
				});
				if ("error" in res && res.error) {
					toast.error(String(res.error));
				} else {
					setStatus("rejected");
					toast.info("Action proposal dismissed.");
					onActionResolved?.();
				}
			} catch (err: unknown) {
				toast.error(
					err instanceof Error ? err.message : "Failed to reject action.",
				);
			}
		});
	};

	const getTitle = () => {
		switch (action.actionType) {
			case "update_task_status":
				return `Change Task Status → ${String(action.payload.newStatus || "")}`;
			case "create_task":
				return `Create Project Task: ${String(action.payload.title || "")}`;
			case "request_leave":
				return `Submit ${String(action.payload.leaveType || "")} Leave Request (${String(action.payload.totalDays || 1)}d)`;
			case "cancel_leave_request":
				return "Cancel Leave Request";
			case "report_asset_issue":
				return `Report Equipment Defect for ${String(action.payload.assetTag || "")}`;
			default:
				return `Proposed Mutation: ${action.actionType}`;
		}
	};

	return (
		<div className="border border-border bg-card p-3.5 space-y-2.5 my-2.5 text-xs">
			<div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
				<div className="flex items-center gap-2">
					<span className="font-heading font-semibold text-foreground">
						{getTitle()}
					</span>
					<Badge
						variant={
							status === "confirmed"
								? "default"
								: status === "rejected" ||
										status === "expired" ||
										status === "failed"
									? "secondary"
									: "outline"
						}
						className="text-[10px] uppercase font-mono px-1.5 py-0"
					>
						{status}
					</Badge>
				</div>
				<div className="flex items-center gap-1 text-[11px] text-muted-foreground">
					<Clock className="w-3 h-3" />
					<span>Human Confirmation Required</span>
				</div>
			</div>

			<div className="bg-background/80 border border-border/40 p-2.5 font-mono text-[11px] space-y-1">
				{Object.entries(action.payload).map(([k, v]) => (
					<div key={k} className="flex items-center justify-between gap-4">
						<span className="text-muted-foreground uppercase">{k}:</span>
						<span className="text-foreground font-medium text-right truncate">
							{String(v)}
						</span>
					</div>
				))}
			</div>

			{status === "pending" && (
				<div className="flex items-center justify-end gap-2 pt-1">
					<Button
						variant="outline"
						size="sm"
						onClick={handleReject}
						disabled={isPending}
						className="h-7 text-xs gap-1"
					>
						<X className="w-3 h-3" />
						Reject
					</Button>
					<Button
						variant="default"
						size="sm"
						onClick={handleConfirm}
						disabled={isPending}
						className="h-7 text-xs gap-1"
					>
						<Check className="w-3 h-3" />
						Confirm & Execute
					</Button>
				</div>
			)}
		</div>
	);
}
