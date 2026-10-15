import { useRouter } from "@tanstack/react-router";
import { useTransition } from "react";
import { toast } from "sonner";
import { cancelLeaveRequest, cancelWfhRequest } from "#/api/leaves";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDateTimeDisplay } from "@/lib/date-format";

type RequestItemType = {
	id: string;
	kind: "leave" | "wfh";
	label: string;
	date: string;
	status: string;
	createdAt: string;
	days?: number;
	actionedByName?: string;
	actionedAt?: string;
	decisionReason?: string | null;
};

interface MyRequestItemProps {
	item: RequestItemType;
}

export function MyRequestItem({ item }: MyRequestItemProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	const handleCancel = () => {
		startTransition(async () => {
			const res =
				item.kind === "leave"
					? await cancelLeaveRequest({ data: item.id })
					: await cancelWfhRequest({ data: item.id });

			if (res?.error) {
				toast.error("Cancellation failed", { description: res.error });
			} else {
				toast.success("Request updated");
				router.invalidate();
			}
		});
	};

	return (
		<div className="flex items-center justify-between gap-3 px-4 py-3">
			<div className="flex min-w-0 flex-col">
				<div className="flex items-center gap-2">
					<span className="truncate text-sm font-medium">{item.label}</span>
					{item.days && (
						<span className="text-xs text-muted-foreground">
							({item.days}d)
						</span>
					)}
				</div>
				<span className="text-xs text-muted-foreground">{item.date}</span>
				{item.status !== "pending" &&
					item.status !== "pending_cancellation" &&
					item.actionedByName && (
						<span className="text-xs text-muted-foreground">
							{item.status === "approved"
								? "Approved"
								: item.status === "rejected"
									? "Rejected"
									: item.status === "revoked"
										? "Revoked"
										: "Cancelled"}{" "}
							by {item.actionedByName}
							{item.actionedAt
								? ` on ${formatDateTimeDisplay(item.actionedAt)}`
								: ""}
						</span>
					)}
				{item.status === "pending_cancellation" && (
					<span className="text-xs text-muted-foreground">
						Cancellation requested — awaiting lead approval
					</span>
				)}
				{item.decisionReason && (
					<span className="line-clamp-1 text-xs text-muted-foreground">
						Decision reason: {item.decisionReason}
					</span>
				)}
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<StatusBadge status={item.status} />
				{item.status === "pending" && (
					<Button
						size="sm"
						variant="ghost"
						onClick={handleCancel}
						disabled={isPending}
					>
						{isPending ? "Cancelling..." : "Cancel"}
					</Button>
				)}
				{item.status === "approved" &&
					(item.kind === "leave" || item.kind === "wfh") && (
						<Button
							size="sm"
							variant="outline"
							className="border-destructive/30 hover:bg-destructive/10 text-destructive h-7 rounded-full"
							onClick={handleCancel}
							disabled={isPending}
						>
							{isPending ? "Requesting..." : "Request Cancel"}
						</Button>
					)}
			</div>
		</div>
	);
}
