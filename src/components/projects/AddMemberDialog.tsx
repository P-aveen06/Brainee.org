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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface AddMemberDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedUserId: string;
	onSelectedUserIdChange: (val: string) => void;
	selectedRole: "manager" | "contributor" | "viewer";
	onSelectedRoleChange: (val: "manager" | "contributor" | "viewer") => void;
	allocationPercent: string;
	onAllocationPercentChange: (val: string) => void;
	availableCandidates: Array<{
		id: string;
		name: string | null;
		email: string | null;
	}>;
	onSubmit: (e: React.FormEvent) => void;
	isPending: boolean;
}

export function AddMemberDialog({
	open,
	onOpenChange,
	selectedUserId,
	onSelectedUserIdChange,
	selectedRole,
	onSelectedRoleChange,
	allocationPercent,
	onAllocationPercentChange,
	availableCandidates,
	onSubmit,
	isPending,
}: AddMemberDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Add Team Member</DialogTitle>
						<DialogDescription>
							Grant an employee access to this project.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-1.5">
							<Label htmlFor="employee">
								Employee <span className="text-destructive">*</span>
							</Label>
							<Select
								value={selectedUserId}
								onValueChange={(v) => v && onSelectedUserIdChange(v)}
							>
								<SelectTrigger id="employee">
									<SelectValue placeholder="Choose employee" />
								</SelectTrigger>
								<SelectContent>
									{availableCandidates.map((u) => (
										<SelectItem key={u.id} value={u.id}>
											{u.name || u.email}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="memberRole">Project Role</Label>
							<Select
								value={selectedRole}
								onValueChange={(v) =>
									v &&
									onSelectedRoleChange(
										v as "manager" | "contributor" | "viewer",
									)
								}
							>
								<SelectTrigger id="memberRole">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="manager">
										Manager (tasks, settings, milestones)
									</SelectItem>
									<SelectItem value="contributor">
										Contributor (create & update tasks)
									</SelectItem>
									<SelectItem value="viewer">
										Viewer (read-only observer)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="allocation">Allocation (%)</Label>
							<Input
								id="allocation"
								type="number"
								min="1"
								max="100"
								value={allocationPercent}
								onChange={(e) => onAllocationPercentChange(e.target.value)}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isPending || !selectedUserId || !selectedUserId.trim()}
						>
							{isPending ? "Adding..." : "Add to Team"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
