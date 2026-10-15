"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
	status: string;
	className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
	const norm = status.toLowerCase();

	switch (norm) {
		case "approved":
			return (
				<Badge
					className={cn(
						"bg-status-logged text-status-logged-foreground hover:bg-status-logged/80 border-0 rounded-md font-medium px-2 py-0.5 text-xs shadow-none",
						className,
					)}
				>
					Approved
				</Badge>
			);
		case "pending":
			return (
				<Badge
					className={cn(
						"bg-status-pending text-status-pending-foreground hover:bg-status-pending/80 border-0 rounded-md font-medium px-2 py-0.5 text-xs shadow-none",
						className,
					)}
				>
					Pending
				</Badge>
			);
		case "rejected":
			return (
				<Badge
					className={cn(
						"bg-destructive/10 text-destructive hover:bg-destructive/20 border-0 rounded-md font-medium px-2 py-0.5 text-xs shadow-none",
						className,
					)}
				>
					Rejected
				</Badge>
			);
		case "revoked":
			return (
				<Badge
					className={cn(
						"bg-status-reentry text-status-reentry-foreground hover:bg-status-reentry/80 border-0 rounded-md font-medium px-2 py-0.5 text-xs shadow-none",
						className,
					)}
				>
					Revoked
				</Badge>
			);
		case "cancelled":
			return (
				<Badge
					className={cn(
						"bg-muted text-muted-foreground hover:bg-muted/80 border-0 rounded-md font-medium px-2 py-0.5 text-xs shadow-none",
						className,
					)}
				>
					Cancelled
				</Badge>
			);
		case "pending_cancellation":
		case "cancellation pending":
			return (
				<Badge
					className={cn(
						"bg-coral/10 text-coral hover:bg-coral/20 border-0 rounded-md font-medium px-2 py-0.5 text-xs shadow-none",
						className,
					)}
				>
					Cancellation Pending
				</Badge>
			);
		default:
			return (
				<Badge
					className={cn(
						"bg-muted text-muted-foreground hover:bg-muted/80 border-0 rounded-md font-medium px-2 py-0.5 text-xs shadow-none capitalize",
						className,
					)}
				>
					{status}
				</Badge>
			);
	}
}
