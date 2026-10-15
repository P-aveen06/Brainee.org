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

interface ProjectArchiveDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectName: string;
	onConfirm: () => void;
	isArchiving: boolean;
}

export function ProjectArchiveDialog({
	open,
	onOpenChange,
	projectName,
	onConfirm,
	isArchiving,
}: ProjectArchiveDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Archive Project</DialogTitle>
					<DialogDescription>
						Are you sure you want to archive{" "}
						<span className="font-semibold text-foreground">{projectName}</span>
						? Archived projects are hidden from active filters but records are
						retained.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isArchiving}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={onConfirm}
						disabled={isArchiving}
					>
						{isArchiving ? "Archiving..." : "Confirm Archive"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
