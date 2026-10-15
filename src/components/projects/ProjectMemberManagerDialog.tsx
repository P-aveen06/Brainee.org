"use client";

import { Users } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectAccess } from "@/lib/project-access";
import {
	MemberManagerPanel,
	type ProjectMemberItem,
} from "./MemberManagerDialog";

interface ProjectMemberManagerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	projectName: string;
	projectCode: string;
	members: ProjectMemberItem[];
	allUsers: Array<{
		id: string;
		name: string | null;
		email: string | null;
		role: string | null;
	}>;
	access: ProjectAccess;
	onSuccess: () => void;
}

export function ProjectMemberManagerDialog({
	open,
	onOpenChange,
	projectId,
	projectName,
	projectCode,
	members,
	allUsers,
	access,
	onSuccess,
}: ProjectMemberManagerDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Users className="size-4 text-primary" />
						<span>Project Team & Members</span>
						<span className="font-mono text-xs text-muted-foreground font-normal">
							({projectCode} · {projectName})
						</span>
					</DialogTitle>
					<DialogDescription>
						{access.canManage
							? "Add team members, assign manager/contributor/viewer roles, and transfer project ownership."
							: "View current active project members and roll-off history."}
					</DialogDescription>
				</DialogHeader>

				<div className="pt-2">
					<MemberManagerPanel
						projectId={projectId}
						members={members}
						allUsers={allUsers}
						access={access}
						onSuccess={onSuccess}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
