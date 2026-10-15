"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDateDisplay, formatDateTimeDisplay } from "@/lib/date-format";
import { formatLeaveType } from "@/lib/leave-policy";
import { getInitials } from "@/lib/utils";
import { ReasonDialog } from "./ReasonDialog";
import { RequestViolationAlert } from "./RequestViolationAlert";
import { useRequestActions } from "./useRequestActions";

type RequestItem = {
	id: string;
	type: "leave" | "wfh";
	status: string;
	employeeName: string;
	avatarUrl?: string;
	avatar_url?: string;
	leaveType?: string;
	startDate: string;
	endDate?: string;
	totalDays?: number;
	reason?: string | null;
	createdAt: string;
	actionedByName?: string;
	actionedAt?: string;
	decisionReason?: string | null;
	ruleViolationNote?: string | null;
};

type RequestCardProps = {
	request: RequestItem;
	isAdmin: boolean;
};

export function RequestCard({ request, isAdmin }: RequestCardProps) {
	const {
		isPending,
		error,
		dialogAction,
		setDialogAction,
		handleApprove,
		handleRejectOrRevoke,
	} = useRequestActions(request);

	const initials = getInitials(request.employeeName);

	return (
		<>
			<div
				className="flex flex-col gap-3 bg-card px-4 py-3 transition-colors hover:bg-secondary/30 md:flex-row md:items-center md:justify-between"
				aria-busy={isPending}
			>
				<div className="flex min-w-0 items-start gap-3">
					<Avatar className="size-8 shrink-0">
						<AvatarImage src={request.avatarUrl || request.avatar_url} />
						<AvatarFallback className="text-xs">{initials}</AvatarFallback>
					</Avatar>
					<div className="min-w-0 space-y-0.5">
						<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
							<p className="truncate text-sm font-medium text-foreground">
								{request.employeeName}
							</p>
							<StatusBadge status={request.status} />
						</div>
						<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
							<span>
								{request.type === "leave" && request.leaveType
									? formatLeaveType(request.leaveType)
									: "WFH"}
								{request.totalDays ? ` · ${request.totalDays} days` : ""}
							</span>
							<span aria-hidden="true">·</span>
							<span>
								{formatDateDisplay(request.startDate)}
								{request.endDate && request.endDate !== request.startDate
									? ` -> ${formatDateDisplay(request.endDate)}`
									: ""}
							</span>
						</div>
						{request.reason && (
							<p className="line-clamp-1 text-xs italic text-muted-foreground">
								&ldquo;{request.reason}&rdquo;
							</p>
						)}
						<RequestViolationAlert note={request.ruleViolationNote} />
						{request.status !== "pending" &&
							request.status !== "pending_cancellation" &&
							request.actionedByName && (
								<p className="text-xs text-muted-foreground">
									{request.status === "approved"
										? "Approved"
										: request.status === "rejected"
											? "Rejected"
											: "Revoked"}{" "}
									by {request.actionedByName}
									{request.actionedAt
										? ` on ${formatDateTimeDisplay(request.actionedAt)}`
										: ""}
								</p>
							)}
						{request.decisionReason && (
							<p className="line-clamp-1 text-xs text-muted-foreground">
								Decision reason: {request.decisionReason}
							</p>
						)}
						{error && (
							<p className="text-xs text-destructive" role="alert">
								{error}
							</p>
						)}
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-2 md:justify-end">
					{request.status === "pending" ? (
						<>
							<Button
								size="sm"
								onClick={handleApprove}
								disabled={isPending}
								aria-label="Approve request"
								className="h-7 px-3 text-xs rounded-full"
							>
								<Check className="size-3 mr-1" aria-hidden="true" /> Approve
							</Button>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => setDialogAction("reject")}
								disabled={isPending}
								aria-label="Reject request"
								className="h-7 px-3 text-xs rounded-full"
							>
								<X className="size-3 mr-1" aria-hidden="true" /> Reject
							</Button>
						</>
					) : request.status === "pending_cancellation" ? (
						<>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => setDialogAction("revoke")}
								disabled={isPending}
								aria-label="Approve cancellation request"
								className="h-7 px-3 text-xs rounded-full"
							>
								<Check className="size-3 mr-1" aria-hidden="true" /> Approve
								Cancellation
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setDialogAction("reject_cancellation")}
								disabled={isPending}
								aria-label="Decline cancellation request"
								className="h-7 px-3 text-xs rounded-full"
							>
								<X className="size-3 mr-1" aria-hidden="true" /> Decline
								Cancellation
							</Button>
						</>
					) : request.status === "approved" && isAdmin ? (
						<Button
							size="sm"
							variant="outline"
							onClick={() => setDialogAction("revoke")}
							disabled={isPending}
							aria-label="Revoke approved request"
							className="h-7 px-3 text-xs rounded-full"
						>
							<RotateCcw className="size-3 mr-1" aria-hidden="true" /> Revoke
						</Button>
					) : null}
				</div>
			</div>

			<ReasonDialog
				open={dialogAction !== null}
				onClose={() => setDialogAction(null)}
				onConfirm={handleRejectOrRevoke}
				title={
					dialogAction === "reject"
						? "Reject Request"
						: dialogAction === "revoke"
							? "Approve Cancellation"
							: "Decline Cancellation"
				}
				description={
					dialogAction === "reject"
						? "Please provide a reason for rejecting this request."
						: dialogAction === "revoke"
							? "Optionally provide a reason for approving this cancellation request."
							: "Please provide a reason for declining this cancellation request."
				}
				confirmLabel={
					dialogAction === "reject"
						? "Reject"
						: dialogAction === "revoke"
							? "Approve Cancellation"
							: "Decline"
				}
				required={
					dialogAction === "reject" ||
					dialogAction === "reject_cancellation" ||
					dialogAction === "revoke"
				}
				isPending={isPending}
			/>
		</>
	);
}
