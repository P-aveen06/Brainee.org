"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ReasonDialogProps = {
	open: boolean;
	onClose: () => void;
	onConfirm: (reason: string) => void;
	title: string;
	description: string;
	confirmLabel: string;
	required?: boolean;
	isPending?: boolean;
};

export function ReasonDialog({
	open,
	onClose,
	onConfirm,
	title,
	description,
	confirmLabel,
	required = false,
	isPending = false,
}: ReasonDialogProps) {
	const [reason, setReason] = useState("");
	const [error, setError] = useState("");

	function handleSubmit() {
		const trimmed = reason.trim();
		if (required && !trimmed) {
			setError("A reason is required for rejection.");
			return;
		}
		setError("");
		onConfirm(trimmed);
	}

	function handleClose() {
		setReason("");
		setError("");
		onClose();
	}

	return (
		<Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">{title}</DialogTitle>
					<DialogDescription className="text-xs">
						{description}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="reason-input" className="text-xs">
						{required ? "Reason (Required)" : "Reason (Optional)"}
					</Label>
					<Textarea
						id="reason-input"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder={
							required
								? "Enter reason for rejection..."
								: "Enter reason (optional)..."
						}
						rows={3}
						maxLength={500}
						className="text-xs"
					/>
					{error && (
						<p className="text-xs text-destructive" role="alert">
							{error}
						</p>
					)}
				</div>
				<DialogFooter>
					<Button
						size="sm"
						variant="outline"
						onClick={handleClose}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						size="sm"
						variant="destructive"
						onClick={handleSubmit}
						disabled={isPending}
						aria-busy={isPending}
					>
						{isPending ? "Processing..." : confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
