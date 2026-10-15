"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { LeaveBalanceEditor } from "./LeaveBalanceEditor";
import { useEmployeeEdit } from "./useEmployeeEdit";

type UserRow = {
	id: string;
	name: string | null;
	email: string | null;
	role: string | null;
	standard_hours: number | null;
	peer_lead_id: string | null;
	join_date: string | null;
	birthday: string | null;
};

type EmployeeEditSheetProps = {
	user: UserRow | null;
	allUsers: Pick<UserRow, "id" | "name">[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function EmployeeEditSheet({
	user,
	allUsers,
	open,
	onOpenChange,
}: EmployeeEditSheetProps) {
	const {
		isPending,
		error,
		role,
		setRole,
		standardHours,
		setStandardHours,
		peerLeadId,
		setPeerLeadId,
		joinDate,
		setJoinDate,
		birthday,
		setBirthday,
		handleSave,
	} = useEmployeeEdit({ user, onOpenChange });

	if (!user) return null;

	const peerLeadOptions = allUsers.filter((u) => u.id !== user.id);
	const selectedPeerLead = peerLeadOptions.find((u) => u.id === peerLeadId);
	const peerLeadLabel =
		peerLeadId === "none"
			? "None"
			: selectedPeerLead?.name || "Unknown peer lead";
	const roleLabel =
		role === "admin" ? "Admin" : role === "lead" ? "Lead" : "User";

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-[400px] sm:w-[540px]">
				<SheetHeader>
					<SheetTitle>Edit Employee</SheetTitle>
					<SheetDescription>
						Update settings and role for {user.name || user.email}.
					</SheetDescription>
				</SheetHeader>

				<SheetBody className="space-y-6">
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<Label htmlFor="role">Role</Label>
						<Select
							value={role}
							onValueChange={(val) => setRole(val || "user")}
							disabled={isPending}
						>
							<SelectTrigger id="role">
								<SelectValue placeholder="Select role">{roleLabel}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="user">User</SelectItem>
								<SelectItem value="lead">Lead</SelectItem>
								<SelectItem value="admin">Admin</SelectItem>
							</SelectContent>
						</Select>
						{role === "admin" && role !== user.role && (
							<p className="text-xs text-muted-foreground mt-1 text-status-reentry-foreground">
								Warning: Admins have full access to the system.
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="standardHours">Standard Hours per Day</Label>
						<Input
							id="standardHours"
							type="number"
							min="1"
							max="24"
							step="0.5"
							value={standardHours}
							onChange={(e) => setStandardHours(e.target.value)}
							disabled={isPending}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="peerLead">Peer Lead</Label>
						<Select
							value={peerLeadId}
							onValueChange={(val) => setPeerLeadId(val || "none")}
							disabled={isPending}
						>
							<SelectTrigger id="peerLead">
								<span
									data-slot="select-value"
									className="flex flex-1 items-center gap-1.5 text-left"
								>
									{peerLeadLabel}
								</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">None</SelectItem>
								{peerLeadId !== "none" && !selectedPeerLead && (
									<SelectItem value={peerLeadId}>Unknown peer lead</SelectItem>
								)}
								{peerLeadOptions.map((u) => (
									<SelectItem key={u.id} value={u.id}>
										{u.name || "Unknown"}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground mt-1">
							Optional peer lead for this user.
						</p>
					</div>

					<div className="pt-4 border-t space-y-4">
						<div className="space-y-2">
							<h4 className="text-sm font-heading font-semibold tracking-tight">
								Leave Cycle Dates
							</h4>
							<p className="text-xs text-muted-foreground">
								Set these dates to automatically determine when the
								employee&apos;s leave cycle resets.
							</p>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="joinDate">Join Date</Label>
									<Input
										id="joinDate"
										type="date"
										value={joinDate}
										onChange={(e) => setJoinDate(e.target.value)}
										disabled={isPending}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="birthday">Birthday</Label>
									<Input
										id="birthday"
										type="date"
										value={birthday}
										onChange={(e) => setBirthday(e.target.value)}
										disabled={isPending}
									/>
								</div>
							</div>
						</div>

						<div className="pt-4 border-t">
							<h4 className="text-sm font-heading font-semibold tracking-tight mb-4">
								Leave Balances ({new Date().getFullYear()})
							</h4>
							<LeaveBalanceEditor
								userId={user.id}
								year={new Date().getFullYear()}
							/>
						</div>
					</div>
				</SheetBody>

				<SheetFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={isPending}
						aria-busy={isPending}
						className="rounded-full"
					>
						{isPending ? "Saving..." : "Save Changes"}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
