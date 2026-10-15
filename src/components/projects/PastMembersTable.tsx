"use client";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ProjectMemberItem } from "./ActiveMembersTable";
import { MemberRoleBadge } from "./MemberRoleBadge";

interface PastMembersTableProps {
	members: ProjectMemberItem[];
}

export function PastMembersTable({ members }: PastMembersTableProps) {
	if (members.length === 0) return null;

	return (
		<div className="space-y-2 pt-2">
			<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
				Past Members ({members.length})
			</h4>
			<div className="border border-border/60 overflow-hidden bg-muted/20">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Member</TableHead>
							<TableHead>Former Role</TableHead>
							<TableHead>Tenure</TableHead>
							<TableHead>Reason</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{members.map((member) => (
							<TableRow key={member.id} className="opacity-75">
								<TableCell className="text-xs font-medium">
									{member.userName}
								</TableCell>
								<TableCell>
									<MemberRoleBadge role={member.role} />
								</TableCell>
								<TableCell className="text-xs text-muted-foreground">
									{member.joinedAt || "?"} → {member.leftAt || "Departed"}
								</TableCell>
								<TableCell className="text-xs capitalize text-muted-foreground">
									{member.leaveReason?.replace(/_/g, " ") || "Rolled off"}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
