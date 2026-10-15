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

interface TaskDeleteConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	taskNumber: number;
	projectCode: string;
	onConfirm: () => void;
	isPending: boolean;
}

export function TaskDeleteConfirmDialog({
	open,
	onOpenChange,
	taskNumber,
	projectCode,
	onConfirm,
	isPending,
}: TaskDeleteConfirmDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-destructive">Delete Task</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete{" "}
						<strong>
							{projectCode} #{taskNumber}
						</strong>
						? Any subtasks under this item will also be removed. This action
						cannot be undone.
					</DialogDescription>
				</DialogHeader>

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
						disabled={isPending}
					>
						{isPending ? "Deleting..." : "Delete Permanently"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
