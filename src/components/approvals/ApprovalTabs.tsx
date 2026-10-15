import { useCallback, useState } from "react";
import { getApprovalsLive } from "#/api/admin";
import { useRequestRealtime } from "#/hooks/useRealtimeTables";
import type { ApprovalRequestItem } from "#/lib/approvals-live-data.server";
import { PageTabs } from "@/components/ui/page-tabs";
import { ApprovalFilterBar } from "./ApprovalFilterBar";
import { RequestCard } from "./RequestCard";

type ApprovalTabsProps = {
	pending: ApprovalRequestItem[];
	history: ApprovalRequestItem[];
	isAdmin: boolean;
};

export function ApprovalTabs({ pending, history, isAdmin }: ApprovalTabsProps) {
	const [view, setView] = useState<"pending" | "history">("pending");
	const [liveData, setLiveData] = useState({ pending, history });
	const [searchTerm, setSearchTerm] = useState("");
	const [userFilter, setUserFilter] = useState("all");
	const [typeFilter, setTypeFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");

	const typeFilterLabel =
		typeFilter === "leave"
			? "Leave"
			: typeFilter === "wfh"
				? "WFH"
				: "All Types";

	const statusFilterLabel =
		statusFilter === "pending_approval"
			? "Pending Approval"
			: statusFilter === "pending_cancellation"
				? "Cancellation Requested"
				: statusFilter === "approved"
					? "Approved"
					: statusFilter === "rejected"
						? "Rejected"
						: statusFilter === "revoked"
							? "Revoked"
							: "All Statuses";

	const refreshRequests = useCallback(async () => {
		const data = await getApprovalsLive();
		if (data && !("error" in data)) {
			setLiveData(data);
		}
	}, []);

	useRequestRealtime(refreshRequests);

	const handleViewChange = (v: string) => {
		setView(v as "pending" | "history");
		setStatusFilter("all");
		setUserFilter("all");
	};

	const items = view === "pending" ? liveData.pending : liveData.history;

	// Extract all unique users who have requests to display in the dropdown
	const allUniqueUsers = Array.from(
		new Set([
			...liveData.pending.map((r) => r.employeeName),
			...liveData.history.map((r) => r.employeeName),
		]),
	).sort();

	const filteredItems = items.filter((r) => {
		if (
			searchTerm &&
			!r.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
		) {
			return false;
		}

		if (userFilter !== "all" && r.employeeName !== userFilter) {
			return false;
		}

		if (typeFilter !== "all" && r.type !== typeFilter) {
			return false;
		}

		if (statusFilter !== "all") {
			if (statusFilter === "pending_cancellation") {
				return r.status === "pending_cancellation";
			}
			if (statusFilter === "pending_approval") {
				return r.status === "pending";
			}
			return r.status === statusFilter;
		}

		return true;
	});

	const handleReset = () => {
		setSearchTerm("");
		setUserFilter("all");
		setTypeFilter("all");
		setStatusFilter("all");
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<PageTabs
					items={[
						{
							value: "pending",
							label: `Pending${liveData.pending.length > 0 ? ` (${liveData.pending.length})` : ""}`,
						},
						{ value: "history", label: "History" },
					]}
					value={view}
					onChange={handleViewChange}
					ariaLabel="Approval queues"
				/>
			</div>

			{/* Dynamic Filters Bar Subcomponent */}
			<ApprovalFilterBar
				searchTerm={searchTerm}
				onSearchTermChange={setSearchTerm}
				userFilter={userFilter}
				onUserFilterChange={setUserFilter}
				typeFilter={typeFilter}
				onTypeFilterChange={setTypeFilter}
				statusFilter={statusFilter}
				onStatusFilterChange={setStatusFilter}
				allUniqueUsers={allUniqueUsers}
				view={view}
				typeFilterLabel={typeFilterLabel}
				statusFilterLabel={statusFilterLabel}
				onReset={handleReset}
			/>

			{filteredItems.length > 0 ? (
				<div className="divide-y overflow-hidden rounded-xl border border-border bg-card">
					{filteredItems.map((r) => (
						<RequestCard
							key={`${r.type}-${r.id}`}
							request={r}
							isAdmin={isAdmin}
						/>
					))}
				</div>
			) : (
				<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
					<svg
						className="w-12 h-12 mb-3 opacity-20"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<p className="text-sm font-medium">No requests found</p>
					<p className="text-xs">Adjust your search or filter options.</p>
				</div>
			)}
		</div>
	);
}
