"use client";

import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Eye, Pencil, UserMinus } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { EmployeeDeactivateDialog } from "./EmployeeDeactivateDialog";
import { EmployeeEditSheet } from "./EmployeeEditSheet";
import { RoleBadge } from "./RoleBadge";

type UserRow = {
	id: string;
	name: string | null;
	email: string | null;
	role: string | null;
	standard_hours: number | null;
	peer_lead_id: string | null;
	join_date: string | null;
	birthday: string | null;
	avatar_url?: string | null;
	created_at: string;
	is_active?: boolean;
	exit_date?: string | null;
};

type EmployeeTableProps = {
	users: UserRow[];
};

import { DataTableContainer } from "@/components/layout/data-table-layout";

export function EmployeeTable({ users }: EmployeeTableProps) {
	const navigate = useNavigate();
	const router = useRouter();
	const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [userToDeactivate, setUserToDeactivate] = useState<UserRow | null>(
		null,
	);
	const [deactivateOpen, setDeactivateOpen] = useState(false);

	// Peer-lead dropdowns must only offer current employees — assigning a
	// departed person as someone's lead strands their approvals.
	const activeUsersForDropdown = users
		.filter((u) => u.is_active !== false)
		.map((u) => ({ id: u.id, name: u.name }));

	const openDeactivate = (user: UserRow) => {
		setUserToDeactivate(user);
		setDeactivateOpen(true);
	};

	const openDetail = (user: UserRow) => {
		navigate({ to: "/admin/employees/$id", params: { id: user.id } });
	};

	const openEditSheet = (user: UserRow) => {
		setSelectedUser(user);
		setSheetOpen(true);
	};

	const handleSheetOpenChange = (open: boolean) => {
		setSheetOpen(open);
		if (!open) {
			setSelectedUser(null);
		}
	};

	return (
		<>
			<DataTableContainer>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Standard Hours</TableHead>
							<TableHead>Joined</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={7}
									className="text-center h-24 text-muted-foreground"
								>
									No employees found.
								</TableCell>
							</TableRow>
						) : (
							users.map((user) => (
								<TableRow
									key={user.id}
									className="cursor-pointer hover:bg-secondary/40 transition-colors"
									onClick={() => openDetail(user)}
								>
									<TableCell className="font-medium">
										<div className="flex items-center gap-3">
											<Avatar className="h-8 w-8">
												<AvatarImage src={user.avatar_url ?? undefined} />
												<AvatarFallback className="text-xs">
													{user.name?.substring(0, 2).toUpperCase() || "UN"}
												</AvatarFallback>
											</Avatar>
											<Link
												to="/admin/employees/$id"
												params={{ id: user.id }}
												className="hover:underline hover:text-primary transition-colors"
												onClick={(e) => e.stopPropagation()}
											>
												{user.name || "Unknown"}
											</Link>
										</div>
									</TableCell>
									<TableCell>{user.email}</TableCell>
									<TableCell>
										<RoleBadge role={user.role || ""} />
									</TableCell>
									<TableCell>
										{user.is_active === false ? (
											<Badge className="border-0 bg-surface-alt text-muted-foreground font-normal rounded-md px-2 py-0.5">
												Departed{user.exit_date ? ` · ${user.exit_date}` : ""}
											</Badge>
										) : (
											<Badge className="border-0 bg-success/10 text-success font-medium text-xs rounded-md px-2 py-0.5">
												Active
											</Badge>
										)}
									</TableCell>
									<TableCell>{user.standard_hours}h</TableCell>
									<TableCell>
										{formatDateDisplay(new Date(user.created_at))}
									</TableCell>
									<TableCell
										className="text-right"
										onClick={(e) => e.stopPropagation()}
									>
										<div className="flex items-center justify-end gap-2">
											<Link
												to="/admin/employees/$id"
												params={{ id: user.id }}
												className={cn(
													buttonVariants({ variant: "ghost", size: "sm" }),
													"h-8 px-2 hover:bg-muted text-xs flex items-center gap-1",
												)}
											>
												<Eye className="size-3.5" />
											</Link>
											<Button
												variant="ghost"
												size="sm"
												aria-label="Edit employee"
												className="h-8 px-2 hover:bg-muted text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
												onClick={() => openEditSheet(user)}
											>
												<Pencil className="size-3.5" />
											</Button>
											{user.is_active !== false && (
												<Button
													variant="ghost"
													size="sm"
													aria-label="Deactivate employee"
													title="Deactivate employee"
													className="h-8 px-2 hover:bg-destructive/10 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
													onClick={() => openDeactivate(user)}
												>
													<UserMinus className="size-3.5" />
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</DataTableContainer>

			<EmployeeDeactivateDialog
				open={deactivateOpen}
				onOpenChange={setDeactivateOpen}
				employee={userToDeactivate}
				allUsers={activeUsersForDropdown}
				onSuccess={() => router.invalidate()}
			/>

			<EmployeeEditSheet
				key={selectedUser?.id ?? "new"}
				user={selectedUser}
				allUsers={activeUsersForDropdown}
				open={sheetOpen}
				onOpenChange={handleSheetOpenChange}
			/>
		</>
	);
}
