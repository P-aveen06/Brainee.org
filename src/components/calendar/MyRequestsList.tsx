"use client";

import { useRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelLeaveRequest, cancelWfhRequest } from "#/api/leaves";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
	DataTableContainer,
	DataTableFilters,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateDisplay, formatDateTimeDisplay } from "@/lib/date-format";
import { formatLeaveType } from "@/lib/leave-policy";
import { getUserRelation, type UserRelation } from "@/lib/user-helpers";

type LeaveRow = {
	id: string;
	leave_type: string;
	start_date: string;
	end_date: string;
	total_days: number;
	status: string;
	created_at: string;
	updated_at: string;
	rejection_reason?: string | null;
	revoke_reason?: string | null;
	approvedBy?: UserRelation | UserRelation[] | null;
	rejectedBy?: UserRelation | UserRelation[] | null;
	revokedBy?: UserRelation | UserRelation[] | null;
};

type WfhRow = {
	id: string;
	date: string;
	status: string;
	created_at: string;
	updated_at: string;
	isHalfDay?: boolean;
	halfDayPeriod?: string | null;
	rejection_reason?: string | null;
	revoke_reason?: string | null;
	approvedBy?: UserRelation | UserRelation[] | null;
	rejectedBy?: UserRelation | UserRelation[] | null;
	revokedBy?: UserRelation | UserRelation[] | null;
};

interface MyRequestsListProps {
	leaves: LeaveRow[];
	wfhs: WfhRow[];
}

export function MyRequestsList({ leaves, wfhs }: MyRequestsListProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [pendingActionId, setPendingActionId] = useState<string | null>(null);

	const [typeFilter, setTypeFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");

	const typeFilterLabel =
		typeFilter === "leave"
			? "Leave"
			: typeFilter === "wfh"
				? "WFH"
				: "All Types";

	const statusFilterLabel =
		statusFilter === "pending"
			? "Pending"
			: statusFilter === "approved"
				? "Approved"
				: statusFilter === "rejected"
					? "Rejected"
					: statusFilter === "revoked"
						? "Revoked"
						: statusFilter === "cancelled"
							? "Cancelled"
							: statusFilter === "pending_cancellation"
								? "Cancellation Pending"
								: "All Statuses";

	const handleCancel = (id: string, kind: "leave" | "wfh") => {
		setPendingActionId(id);
		startTransition(async () => {
			try {
				const res =
					kind === "leave"
						? await cancelLeaveRequest({ data: id })
						: await cancelWfhRequest({ data: id });

				if (res?.error) {
					toast.error("Cancellation failed", { description: res.error });
				} else {
					toast.success("Request updated");
					router.invalidate();
				}
			} finally {
				setPendingActionId(null);
			}
		});
	};

	const items = [
		...(leaves || []).map((l) => {
			const approvedBy = getUserRelation(l.approvedBy);
			const rejectedBy = getUserRelation(l.rejectedBy);
			const revokedBy = getUserRelation(l.revokedBy);

			return {
				id: l.id,
				kind: "leave" as const,
				label: formatLeaveType(l.leave_type),
				date:
					l.start_date === l.end_date
						? formatDateDisplay(l.start_date)
						: `${formatDateDisplay(l.start_date)} – ${formatDateDisplay(l.end_date)}`,
				status: l.status,
				createdAt: l.created_at,
				days: `${l.total_days}d`,
				actionedByName:
					l.status === "approved"
						? (approvedBy.name ?? undefined)
						: l.status === "rejected"
							? (rejectedBy.name ?? undefined)
							: l.status === "revoked"
								? (revokedBy.name ?? undefined)
								: undefined,
				actionedAt: l.updated_at,
				decisionReason: l.rejection_reason ?? l.revoke_reason,
			};
		}),
		...(wfhs || []).map((w) => {
			const approvedBy = getUserRelation(w.approvedBy);
			const rejectedBy = getUserRelation(w.rejectedBy);
			const revokedBy = getUserRelation(w.revokedBy);

			return {
				id: w.id,
				kind: "wfh" as const,
				label: "WFH",
				date: formatDateDisplay(w.date),
				status: w.status,
				createdAt: w.created_at,
				days: w.isHalfDay ? "0.5d" : "1d",
				actionedByName:
					w.status === "approved"
						? (approvedBy.name ?? undefined)
						: w.status === "rejected"
							? (rejectedBy.name ?? undefined)
							: w.status === "revoked"
								? (revokedBy.name ?? undefined)
								: undefined,
				actionedAt: w.updated_at,
				decisionReason: w.rejection_reason ?? w.revoke_reason,
			};
		}),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const filteredItems = items.filter((item) => {
		if (typeFilter !== "all" && item.kind !== typeFilter) {
			return false;
		}
		if (statusFilter !== "all" && item.status !== statusFilter) {
			return false;
		}
		return true;
	});

	return (
		<div className="space-y-4">
			{/* Toolbar with external title and filters */}
			<DataTableToolbar>
				<DataTableFilters>
					<div className="flex items-center gap-2">
						<Label
							htmlFor="req-type-filter"
							className="text-xs text-muted-foreground"
						>
							Type
						</Label>
						<Select
							value={typeFilter}
							onValueChange={(val) => setTypeFilter(val ?? "all")}
						>
							<SelectTrigger
								id="req-type-filter"
								className="h-8 w-[130px] rounded-md text-xs"
							>
								<SelectValue placeholder="All Types">
									{typeFilterLabel}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="leave">Leave</SelectItem>
								<SelectItem value="wfh">WFH</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-center gap-2">
						<Label
							htmlFor="req-status-filter"
							className="text-xs text-muted-foreground"
						>
							Status
						</Label>
						<Select
							value={statusFilter}
							onValueChange={(val) => setStatusFilter(val ?? "all")}
						>
							<SelectTrigger
								id="req-status-filter"
								className="h-8 w-[160px] rounded-md text-xs"
							>
								<SelectValue placeholder="All Statuses">
									{statusFilterLabel}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Statuses</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="approved">Approved</SelectItem>
								<SelectItem value="rejected">Rejected</SelectItem>
								<SelectItem value="revoked">Revoked</SelectItem>
								<SelectItem value="cancelled">Cancelled</SelectItem>
								<SelectItem value="pending_cancellation">
									Cancellation Pending
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{(typeFilter !== "all" || statusFilter !== "all") && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setTypeFilter("all");
								setStatusFilter("all");
							}}
							className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
						>
							Reset
						</Button>
					)}
				</DataTableFilters>
			</DataTableToolbar>

			{/* Proper Data Table */}
			<DataTableContainer>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[180px]">Type</TableHead>
							<TableHead className="w-[180px]">Dates</TableHead>
							<TableHead className="w-[90px]">Duration</TableHead>
							<TableHead className="w-[140px]">Status</TableHead>
							<TableHead className="min-w-[240px]">
								Details / Approval
							</TableHead>
							<TableHead className="w-[130px] text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredItems.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="h-32 text-center text-muted-foreground"
								>
									No requests found.
								</TableCell>
							</TableRow>
						) : (
							filteredItems.map((item) => (
								<TableRow
									key={`${item.kind}-${item.id}`}
									className="hover:bg-muted/40"
								>
									<TableCell className="font-medium text-foreground">
										{item.label}
									</TableCell>
									<TableCell className="whitespace-nowrap text-xs text-muted-foreground">
										{item.date}
									</TableCell>
									<TableCell>
										<span className="inline-flex items-center rounded-md bg-surface-alt px-2 py-0.5 font-mono text-xs font-medium text-foreground">
											{item.days}
										</span>
									</TableCell>
									<TableCell>
										<StatusBadge status={item.status} />
									</TableCell>
									<TableCell className="text-xs text-muted-foreground">
										{item.status !== "pending" &&
										item.status !== "pending_cancellation" &&
										item.actionedByName ? (
											<div className="space-y-0.5">
												<span>
													{item.status === "approved"
														? "Approved"
														: item.status === "rejected"
															? "Rejected"
															: item.status === "revoked"
																? "Revoked"
																: "Cancelled"}{" "}
													by{" "}
													<strong className="font-medium text-foreground">
														{item.actionedByName}
													</strong>
													{item.actionedAt
														? ` on ${formatDateTimeDisplay(item.actionedAt)}`
														: ""}
												</span>
												{item.decisionReason && (
													<p className="line-clamp-1 text-[11px] text-muted-foreground/80">
														Reason: {item.decisionReason}
													</p>
												)}
											</div>
										) : item.status === "pending_cancellation" ? (
											<span className="font-medium text-amber-600 dark:text-amber-400">
												Cancellation requested — awaiting lead approval
											</span>
										) : item.status === "pending" ? (
											<span className="italic text-muted-foreground">
												Awaiting lead approval
											</span>
										) : (
											<span>—</span>
										)}
									</TableCell>
									<TableCell className="text-right">
										{item.status === "pending" && (
											<Button
												size="sm"
												variant="ghost"
												className="h-7 text-xs hover:bg-destructive/10 hover:text-destructive"
												onClick={() => handleCancel(item.id, item.kind)}
												disabled={isPending && pendingActionId === item.id}
											>
												{isPending && pendingActionId === item.id
													? "Cancelling..."
													: "Cancel"}
											</Button>
										)}
										{item.status === "approved" &&
											(item.kind === "leave" || item.kind === "wfh") && (
												<Button
													size="sm"
													variant="outline"
													className="h-7 rounded-md border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
													onClick={() => handleCancel(item.id, item.kind)}
													disabled={isPending && pendingActionId === item.id}
												>
													{isPending && pendingActionId === item.id
														? "Requesting..."
														: "Request Cancel"}
												</Button>
											)}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</DataTableContainer>
		</div>
	);
}
