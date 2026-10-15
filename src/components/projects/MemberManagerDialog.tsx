"use client";

import { UserPlus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	addProjectMember,
	removeProjectMember,
	transferProjectOwnership,
	updateProjectMember,
} from "@/api/projects";
import { DataTableToolbar } from "@/components/layout/data-table-layout";
import { Button } from "@/components/ui/button";
import type { ProjectAccess } from "@/lib/project-access";
import {
	ActiveMembersTable,
	type ProjectMemberItem,
} from "./ActiveMembersTable";
import { AddMemberDialog } from "./AddMemberDialog";
import { MemberActionModals } from "./MemberActionModals";
import { PastMembersTable } from "./PastMembersTable";

export type { ProjectMemberItem };

interface MemberManagerPanelProps {
	projectId: string;
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

export function MemberManagerPanel({
	projectId,
	members,
	allUsers,
	access,
	onSuccess,
}: MemberManagerPanelProps) {
	const [isPending, startTransition] = useTransition();

	// Modals State
	const [addOpen, setAddOpen] = useState(false);
	const [selectedUserId, setSelectedUserId] = useState("");
	const [selectedRole, setSelectedRole] = useState<
		"manager" | "contributor" | "viewer"
	>("contributor");
	const [allocationPercent, setAllocationPercent] = useState("100");

	const [transferTarget, setTransferTarget] =
		useState<ProjectMemberItem | null>(null);
	const [removeTarget, setRemoveTarget] = useState<ProjectMemberItem | null>(
		null,
	);
	const [removeReason, setRemoveReason] = useState<
		"rolled_off" | "project_reassigned" | "left_company" | "other"
	>("rolled_off");
	const [removeNotes, setRemoveNotes] = useState("");

	const activeMembers = useMemo(
		() => members.filter((m) => m.isCurrent !== false && m.isActive !== false),
		[members],
	);
	const pastMembers = useMemo(
		() => members.filter((m) => m.isCurrent === false || m.isActive === false),
		[members],
	);

	const availableCandidates = useMemo(() => {
		const activeUserIds = new Set(activeMembers.map((m) => m.userId));
		return allUsers.filter((u) => !activeUserIds.has(u.id));
	}, [allUsers, activeMembers]);

	const handleAddMember = (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedUserId) return;

		startTransition(async () => {
			try {
				const res = await addProjectMember({
					data: {
						projectId,
						userId: selectedUserId,
						role: selectedRole,
						allocationPercent: Number(allocationPercent) || 100,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Member added to project");
					setAddOpen(false);
					setSelectedUserId("");
					setSelectedRole("contributor");
					setAllocationPercent("100");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to add member");
			}
		});
	};

	const handleUpdateRole = (
		memberId: string,
		role: "manager" | "contributor" | "viewer",
	) => {
		startTransition(async () => {
			try {
				const res = await updateProjectMember({
					data: { memberId, role },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Role updated");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to update role");
			}
		});
	};

	const handleTransferOwnership = () => {
		if (!transferTarget) return;

		startTransition(async () => {
			try {
				const res = await transferProjectOwnership({
					data: {
						projectId,
						newOwnerUserId: transferTarget.userId,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Project ownership transferred");
					setTransferTarget(null);
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to transfer ownership");
			}
		});
	};

	const handleRemoveMember = () => {
		if (!removeTarget) return;

		startTransition(async () => {
			try {
				const res = await removeProjectMember({
					data: {
						memberId: removeTarget.id,
						reason: removeReason,
						notes: removeNotes || undefined,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Member removed from project");
					setRemoveTarget(null);
					setRemoveNotes("");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to remove member");
			}
		});
	};

	return (
		<>
			<div className="space-y-4">
				{/* Standardized Toolbar */}
				<DataTableToolbar>
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">
							{activeMembers.length} active member
							{activeMembers.length === 1 ? "" : "s"}
						</span>
					</div>

					<div className="flex items-center gap-2">
						{access.canManage && (
							<Button
								size="sm"
								onClick={() => {
									setSelectedUserId(availableCandidates[0]?.id || "");
									setAddOpen(true);
								}}
								disabled={availableCandidates.length === 0}
								className="h-8 text-xs gap-1.5"
							>
								<UserPlus className="size-3.5" />
								Add Member
							</Button>
						)}
					</div>
				</DataTableToolbar>

				{/* Active Members Table */}
				<ActiveMembersTable
					members={activeMembers}
					access={access}
					onUpdateRole={handleUpdateRole}
					onTransferOwnership={setTransferTarget}
					onRemoveMember={setRemoveTarget}
				/>

				{/* Past Members History */}
				{pastMembers.length > 0 && (
					<div className="pt-2">
						<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Past Members ({pastMembers.length})
						</h4>
						<PastMembersTable members={pastMembers} />
					</div>
				)}
			</div>

			{/* Add Member Dialog Subcomponent */}
			<AddMemberDialog
				open={addOpen}
				onOpenChange={setAddOpen}
				selectedUserId={selectedUserId}
				onSelectedUserIdChange={setSelectedUserId}
				selectedRole={selectedRole}
				onSelectedRoleChange={setSelectedRole}
				allocationPercent={allocationPercent}
				onAllocationPercentChange={setAllocationPercent}
				availableCandidates={availableCandidates}
				onSubmit={handleAddMember}
				isPending={isPending}
			/>

			{/* Action Modals Subcomponent (Transfer & Remove) */}
			<MemberActionModals
				transferTarget={transferTarget}
				onTransferTargetChange={setTransferTarget}
				onConfirmTransfer={handleTransferOwnership}
				removeTarget={removeTarget}
				onRemoveTargetChange={setRemoveTarget}
				removeReason={removeReason}
				onRemoveReasonChange={(v) => setRemoveReason(v as typeof removeReason)}
				removeNotes={removeNotes}
				onRemoveNotesChange={setRemoveNotes}
				onConfirmRemove={handleRemoveMember}
				isPending={isPending}
			/>
		</>
	);
}
