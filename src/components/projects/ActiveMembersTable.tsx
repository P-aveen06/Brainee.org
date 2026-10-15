"use client";

import { Crown, MoreHorizontal, UserMinus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ProjectAccess } from "@/lib/project-access";
import { MemberRoleBadge } from "./MemberRoleBadge";

export interface ProjectMemberItem {
	id: string;
	projectId: string;
	userId: string;
	userName?: string | null;
	userEmail?: string | null;
	userAvatarUrl?: string | null;
	role: "owner" | "manager" | "contributor" | "viewer";
	allocationPercent?: number | null;
	joinedAt?: string | null;
	leftAt?: string | null;
	leaveReason?: string | null;
	isActive?: boolean;
	isCurrent?: boolean;
}

interface ActiveMembersTableProps {
	members: ProjectMemberItem[];
	access: ProjectAccess;
	onUpdateRole: (
		memberId: string,
		role: "manager" | "contributor" | "viewer",
	) => void;
	onTransferOwnership: (member: ProjectMemberItem) => void;
	onRemoveMember: (member: ProjectMemberItem) => void;
}

export function ActiveMembersTable({
	members,
	access,
	onUpdateRole,
	onTransferOwnership,
	onRemoveMember,
}: ActiveMembersTableProps) {
	return (
		<div className="border border-border overflow-hidden bg-card">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Member</TableHead>
						<TableHead>Role</TableHead>
						<TableHead>Allocation</TableHead>
						<TableHead>Joined</TableHead>
						{access.canManage && <TableHead className="w-[60px] text-right" />}
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={5}
								className="h-24 text-center text-muted-foreground"
							>
								No active members found.
							</TableCell>
						</TableRow>
					) : (
						members.map((member) => (
							<TableRow key={member.id}>
								<TableCell>
									<div className="flex items-center gap-2.5">
										<Avatar className="size-7">
											<AvatarImage src={member.userAvatarUrl || undefined} />
											<AvatarFallback className="text-xs">
												{member.userName?.slice(0, 2).toUpperCase() || "U"}
											</AvatarFallback>
										</Avatar>
										<div>
											<p className="text-xs font-medium text-foreground">
												{member.userName}
											</p>
											<p className="text-[11px] text-muted-foreground">
												{member.userEmail}
											</p>
										</div>
									</div>
								</TableCell>
								<TableCell>
									<MemberRoleBadge role={member.role} />
								</TableCell>
								<TableCell className="text-xs">
									{member.allocationPercent != null
										? `${member.allocationPercent}%`
										: "100%"}
								</TableCell>
								<TableCell className="text-xs text-muted-foreground">
									{member.joinedAt || "—"}
								</TableCell>
								{access.canManage && (
									<TableCell className="text-right">
										<DropdownMenu>
											<DropdownMenuTrigger
												render={<Button variant="ghost" size="icon-xs" />}
											>
												<MoreHorizontal className="size-4" />
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() => onUpdateRole(member.id, "manager")}
													disabled={member.role === "manager"}
												>
													Set as Manager
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => onUpdateRole(member.id, "contributor")}
													disabled={member.role === "contributor"}
												>
													Set as Contributor
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => onUpdateRole(member.id, "viewer")}
													disabled={member.role === "viewer"}
												>
													Set as Viewer
												</DropdownMenuItem>

												{access.canOwn && member.role !== "owner" && (
													<>
														<DropdownMenuSeparator />
														<DropdownMenuItem
															onClick={() => onTransferOwnership(member)}
														>
															<Crown className="mr-2 size-3.5 text-amber-500" />
															Transfer Ownership
														</DropdownMenuItem>
													</>
												)}

												<DropdownMenuSeparator />
												<DropdownMenuItem
													variant="destructive"
													onClick={() => onRemoveMember(member)}
												>
													<UserMinus className="mr-2 size-3.5" />
													Remove from Team
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								)}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}
