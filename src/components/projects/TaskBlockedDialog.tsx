"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface TaskBlockedDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	reason: string;
	onReasonChange: (val: string) => void;
	onConfirm: () => void;
	isPending: boolean;
}

export function TaskBlockedDialog({
	open,
	onOpenChange,
	reason,
	onReasonChange,
	onConfirm,
	isPending,
}: TaskBlockedDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Mark Task as Blocked</DialogTitle>
					<DialogDescription>
						State clearly why this work item cannot proceed (e.g. waiting on
						client approval, missing credentials).
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2 py-3">
					<label
						htmlFor="blockReason"
						className="text-xs font-medium text-foreground"
					>
						Blocked Reason <span className="text-destructive">*</span>
					</label>
					<Textarea
						id="blockReason"
						placeholder="e.g. Blocked on Unilever VPN configuration access"
						rows={3}
						value={reason}
						onChange={(e) => onReasonChange(e.target.value)}
						required
					/>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={onConfirm}
						disabled={isPending || !reason.trim()}
					>
						{isPending ? "Saving..." : "Set as Blocked"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
