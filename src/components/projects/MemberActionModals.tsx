"use client";

import { Crown, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ProjectMemberItem } from "./MemberManagerDialog";

interface MemberActionModalsProps {
	transferTarget: ProjectMemberItem | null;
	onTransferTargetChange: (member: ProjectMemberItem | null) => void;
	onConfirmTransfer: () => void;
	removeTarget: ProjectMemberItem | null;
	onRemoveTargetChange: (member: ProjectMemberItem | null) => void;
	removeReason: string;
	onRemoveReasonChange: (val: string) => void;
	removeNotes: string;
	onRemoveNotesChange: (val: string) => void;
	onConfirmRemove: () => void;
	isPending: boolean;
}

export function MemberActionModals({
	transferTarget,
	onTransferTargetChange,
	onConfirmTransfer,
	removeTarget,
	onRemoveTargetChange,
	removeReason,
	onRemoveReasonChange,
	removeNotes,
	onRemoveNotesChange,
	onConfirmRemove,
	isPending,
}: MemberActionModalsProps) {
	return (
		<>
			{/* Transfer Ownership Confirmation Dialog */}
			<Dialog
				open={Boolean(transferTarget)}
				onOpenChange={(open) => !open && onTransferTargetChange(null)}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
							<Crown className="size-5" />
							Transfer Project Ownership
						</DialogTitle>
						<DialogDescription>
							Are you sure you want to make{" "}
							<strong>{transferTarget?.userName}</strong> the new primary owner
							of this project? Your role will be changed to Manager.
						</DialogDescription>
					</DialogHeader>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onTransferTargetChange(null)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="default"
							className="bg-amber-600 hover:bg-amber-700 text-white"
							onClick={onConfirmTransfer}
							disabled={isPending}
						>
							{isPending ? "Transferring..." : "Confirm Transfer"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Remove Member Dialog */}
			<Dialog
				open={Boolean(removeTarget)}
				onOpenChange={(open) => !open && onRemoveTargetChange(null)}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<UserMinus className="size-5" />
							Remove from Project Team
						</DialogTitle>
						<DialogDescription>
							Revoke <strong>{removeTarget?.userName}</strong>'s access to this
							project. Their historical updates and task assignments will be
							preserved.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-3">
						<div className="space-y-1.5">
							<Label htmlFor="removeReason">Reason for Roll-off</Label>
							<Select
								value={removeReason}
								onValueChange={(v) => v && onRemoveReasonChange(v)}
							>
								<SelectTrigger id="removeReason">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="rolled_off">
										Project Roll-off / Reallocated
									</SelectItem>
									<SelectItem value="client_request">
										Client Requested Roll-off
									</SelectItem>
									<SelectItem value="departed">Departed Company</SelectItem>
									<SelectItem value="other">Other</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="removeNotes">Handover Notes (Optional)</Label>
							<Input
								id="removeNotes"
								placeholder="e.g. Handed deliverables to Priya"
								value={removeNotes}
								onChange={(e) => onRemoveNotesChange(e.target.value)}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onRemoveTargetChange(null)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={onConfirmRemove}
							disabled={isPending}
						>
							{isPending ? "Removing..." : "Remove Member"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
