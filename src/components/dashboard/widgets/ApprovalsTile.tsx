import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Inbox, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	approveLeaveRequest,
	approveWfhRequest,
	rejectLeaveRequest,
	rejectWfhRequest,
} from "#/api/approvals";
import { AnimatedNumber } from "#/components/motion";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import type { WidgetSize } from "#/lib/dashboard-layout";
import type { PendingItem } from "../types";
import { Tile } from "./Tile";

const keyOf = (item: PendingItem) => `${item.type}-${item.id}`;

export function ApprovalsTile({
	items,
	total,
	onChanged,
	size = "md",
}: {
	items: PendingItem[];
	total: number;
	onChanged: () => void;
	size?: WidgetSize;
}) {
	const [busy, setBusy] = useState<string | null>(null);
	const [rejecting, setRejecting] = useState<string | null>(null);
	const [reason, setReason] = useState("");

	const shownCount = size === "sm" ? 3 : size === "lg" ? 8 : 6;

	async function decide(item: PendingItem, action: "approve" | "reject") {
		setBusy(keyOf(item));
		try {
			const res =
				action === "approve"
					? item.type === "leave"
						? await approveLeaveRequest({ data: item.id })
						: await approveWfhRequest({ data: item.id })
					: item.type === "leave"
						? await rejectLeaveRequest({ data: { id: item.id, reason } })
						: await rejectWfhRequest({ data: { id: item.id, reason } });
			if (res && "error" in res && res.error) {
				toast.error(res.error);
				return;
			}
			toast.success(
				`${action === "approve" ? "Approved" : "Rejected"} ${item.name}'s request`,
			);
			setRejecting(null);
			setReason("");
			onChanged();
		} finally {
			setBusy(null);
		}
	}

	return (
		<Tile title="Pending approvals" icon={Inbox}>
			{total === 0 ? (
				<div className="flex h-full min-h-[220px] flex-col items-center justify-center p-6 text-center">
					<div className="mb-3 flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
						<Check className="size-5" />
					</div>
					<p className="font-heading text-sm font-semibold text-foreground">
						All approvals cleared
					</p>
					<p className="mt-1 max-w-xs text-xs text-muted-foreground">
						Nothing waiting on you. Your team is completely unblocked.
					</p>
				</div>
			) : (
				<>
					<div className="flex items-baseline gap-1.5">
						<span className="font-heading text-2xl font-bold leading-none tracking-[-0.04em]">
							<AnimatedNumber value={total} />
						</span>
						<span className="text-xs text-muted-foreground">
							waiting on you
						</span>
					</div>
					{size === "lg" ? (
						<div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
							{items.slice(0, shownCount).map((item) => {
								const key = keyOf(item);
								const isRejecting = rejecting === key;
								return (
									<div
										key={key}
										className="space-y-2 rounded-xl border border-border/60 bg-surface-alt/40 p-3"
									>
										<div className="flex items-center gap-2.5">
											<Avatar className="size-8 shrink-0">
												<AvatarImage src={item.avatarUrl} />
												<AvatarFallback className="text-xs">
													{item.name.slice(0, 2).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div className="min-w-0 flex-1">
												<p className="truncate text-xs font-semibold text-foreground">
													{item.name}
												</p>
												<p className="truncate text-[11px] text-muted-foreground">
													{item.label} · {item.date}
												</p>
											</div>
											<div className="flex items-center gap-1.5">
												<Button
													size="xs"
													variant="outline"
													className="text-destructive hover:bg-destructive/10"
													disabled={busy === key}
													onClick={() => {
														setReason("");
														setRejecting(isRejecting ? null : key);
													}}
												>
													Reject
												</Button>
												<Button
													size="xs"
													className="bg-emerald-600 text-white hover:bg-emerald-700"
													disabled={busy === key}
													onClick={() => decide(item, "approve")}
												>
													Approve
												</Button>
											</div>
										</div>
										{isRejecting && (
											<form
												className="flex gap-2 pt-1"
												onSubmit={(e) => {
													e.preventDefault();
													void decide(item, "reject");
												}}
											>
												<Input
													autoFocus
													value={reason}
													onChange={(e) => setReason(e.target.value)}
													placeholder="Reason for rejecting"
													className="h-7 text-xs"
												/>
												<Button
													type="submit"
													size="xs"
													variant="destructive"
													disabled={busy === key || reason.trim().length === 0}
												>
													Confirm
												</Button>
											</form>
										)}
									</div>
								);
							})}
						</div>
					) : (
						<ul className="mt-3 space-y-2.5">
							{items.slice(0, shownCount).map((item) => {
								const key = keyOf(item);
								const isRejecting = rejecting === key;
								return (
									<li key={key} className="space-y-2">
										<div className="flex items-center gap-2.5">
											<Avatar className="size-7 shrink-0">
												<AvatarImage src={item.avatarUrl} />
												<AvatarFallback className="text-[10px]">
													{item.name.slice(0, 2).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div className="min-w-0 flex-1">
												<p className="truncate text-[13px] font-medium">
													{item.name}
												</p>
												<p className="truncate text-[11px] text-muted-foreground">
													{item.label} · {item.date}
												</p>
											</div>
											<Button
												size="icon-sm"
												variant="destructive"
												aria-label={`Reject ${item.name}'s request`}
												aria-expanded={isRejecting}
												disabled={busy === key}
												onClick={() => {
													setReason("");
													setRejecting(isRejecting ? null : key);
												}}
											>
												<X />
											</Button>
											<Button
												size="icon-sm"
												className="bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800"
												aria-label={`Approve ${item.name}'s request`}
												disabled={busy === key}
												onClick={() => decide(item, "approve")}
											>
												<Check />
											</Button>
										</div>
										{isRejecting && (
											<form
												className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200"
												onSubmit={(e) => {
													e.preventDefault();
													void decide(item, "reject");
												}}
											>
												<Input
													autoFocus
													value={reason}
													onChange={(e) => setReason(e.target.value)}
													placeholder="Reason for rejecting (required)"
													aria-label="Rejection reason"
													maxLength={500}
													className="h-8 text-xs"
												/>
												<Button
													type="submit"
													size="sm"
													className="bg-destructive text-white hover:bg-destructive/90"
													disabled={busy === key || reason.trim().length === 0}
												>
													Reject
												</Button>
											</form>
										)}
									</li>
								);
							})}
						</ul>
					)}
					<div className="mt-3 pt-2 text-center border-t border-border/40">
						<Link
							to="/approvals"
							className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							{total > shownCount
								? `View ${total - shownCount} more`
								: "View all approvals"}
							<ArrowRight className="size-3" />
						</Link>
					</div>
				</>
			)}
		</Tile>
	);
}
