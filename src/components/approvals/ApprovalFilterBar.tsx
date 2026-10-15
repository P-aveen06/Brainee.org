"use client";

import { Search, X } from "lucide-react";
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

interface ApprovalFilterBarProps {
	searchTerm: string;
	onSearchTermChange: (val: string) => void;
	userFilter: string;
	onUserFilterChange: (val: string) => void;
	typeFilter: string;
	onTypeFilterChange: (val: string) => void;
	statusFilter: string;
	onStatusFilterChange: (val: string) => void;
	allUniqueUsers: string[];
	view: "pending" | "history";
	typeFilterLabel: string;
	statusFilterLabel: string;
	onReset: () => void;
}

export function ApprovalFilterBar({
	searchTerm,
	onSearchTermChange,
	userFilter,
	onUserFilterChange,
	typeFilter,
	onTypeFilterChange,
	statusFilter,
	onStatusFilterChange,
	allUniqueUsers,
	view,
	typeFilterLabel,
	statusFilterLabel,
	onReset,
}: ApprovalFilterBarProps) {
	const hasActiveFilters =
		Boolean(searchTerm) ||
		userFilter !== "all" ||
		typeFilter !== "all" ||
		statusFilter !== "all";

	return (
		<div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-end sm:justify-between">
			<div className="min-w-[200px] flex-1 space-y-1">
				<Label
					htmlFor="employee-search"
					className="text-[11px] font-medium text-muted-foreground"
				>
					Search
				</Label>
				<div className="relative">
					<Search
						className="absolute left-2.5 top-2 size-3.5 text-muted-foreground"
						aria-hidden="true"
					/>
					<Input
						id="employee-search"
						placeholder="Search employee..."
						className="pl-8 pr-7 h-8 text-xs"
						value={searchTerm}
						onChange={(e) => onSearchTermChange(e.target.value)}
					/>
					{searchTerm && (
						<button
							type="button"
							onClick={() => onSearchTermChange("")}
							className="absolute right-2.5 top-2 hover:text-foreground text-muted-foreground transition-colors"
							aria-label="Clear search"
						>
							<X className="size-3.5" />
						</button>
					)}
				</div>
			</div>
			<div className="flex flex-wrap items-end gap-2.5">
				<div className="flex flex-col gap-1">
					<Label
						htmlFor="user-filter"
						className="text-[11px] font-medium text-muted-foreground"
					>
						User
					</Label>
					<Select
						value={userFilter}
						onValueChange={(val) => onUserFilterChange(val ?? "all")}
					>
						<SelectTrigger id="user-filter" className="w-[150px] h-8 text-xs">
							<SelectValue placeholder="All Users">
								{userFilter === "all" ? "All Users" : userFilter}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all" className="text-xs">
								All Users
							</SelectItem>
							{allUniqueUsers.map((name) => (
								<SelectItem key={name} value={name} className="text-xs">
									{name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1">
					<Label
						htmlFor="type-filter"
						className="text-[11px] font-medium text-muted-foreground"
					>
						Type
					</Label>
					<Select
						value={typeFilter}
						onValueChange={(val) => onTypeFilterChange(val ?? "all")}
					>
						<SelectTrigger id="type-filter" className="w-[130px] h-8 text-xs">
							<SelectValue placeholder="All Types">
								{typeFilterLabel}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all" className="text-xs">
								All Types
							</SelectItem>
							<SelectItem value="leave" className="text-xs">
								Leave
							</SelectItem>
							<SelectItem value="wfh" className="text-xs">
								WFH
							</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1">
					<Label
						htmlFor="status-filter"
						className="text-[11px] font-medium text-muted-foreground"
					>
						Status
					</Label>
					<Select
						value={statusFilter}
						onValueChange={(val) => onStatusFilterChange(val ?? "all")}
					>
						<SelectTrigger id="status-filter" className="w-[150px] h-8 text-xs">
							<SelectValue placeholder="All Statuses">
								{statusFilterLabel}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all" className="text-xs">
								All Statuses
							</SelectItem>
							{view === "pending" ? (
								<>
									<SelectItem value="pending_approval" className="text-xs">
										Pending Approval
									</SelectItem>
									<SelectItem value="pending_cancellation" className="text-xs">
										Cancellation Requested
									</SelectItem>
								</>
							) : (
								<>
									<SelectItem value="approved" className="text-xs">
										Approved
									</SelectItem>
									<SelectItem value="rejected" className="text-xs">
										Rejected
									</SelectItem>
									<SelectItem value="revoked" className="text-xs">
										Revoked
									</SelectItem>
								</>
							)}
						</SelectContent>
					</Select>
				</div>

				{hasActiveFilters && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onReset}
						className="text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground"
					>
						Reset
					</Button>
				)}
			</div>
		</div>
	);
}
