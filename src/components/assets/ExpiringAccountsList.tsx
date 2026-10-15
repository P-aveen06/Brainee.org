import { Copy, RefreshCw, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renewAccount } from "@/api/assets";
import {
	DataTableActions,
	DataTableContainer,
	DataTableFilters,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDateDisplay } from "@/lib/date-format";
import { type AssetCategory, AssetCategoryBadge } from "./AssetCategoryBadge";
import { AssetHistoryDrawer } from "./AssetHistoryDrawer";

interface AccountItem {
	id: string;
	assetTag: string;
	name: string;
	category: string;
	assetType: string;
	ownerCompanyName: string | null;
	ownerCompanyCode: string | null;
	ownerCompanyIsInternal: boolean | null;
	serialNumber: string | null;
	model: string | null;
	accountExpiry: string | null;
	renewalDate: string | null;
	status: string;
	currentAssignment: {
		userName: string | null;
		userEmail: string | null;
		userAvatarUrl: string | null;
		assignedDate: string;
	} | null;
}

interface ExpiringAccountsListProps {
	assets: AccountItem[];
	today: string;
	onRefresh: () => void;
}

export function ExpiringAccountsList({
	assets,
	today,
	onRefresh,
}: ExpiringAccountsListProps) {
	const [isPending, startTransition] = useTransition();

	// Search & Filters
	const [searchQuery, setSearchQuery] = useState("");
	const [urgencyFilter, setUrgencyFilter] = useState("all");

	// Quick renew modal
	const [renewDialogOpen, setRenewDialogOpen] = useState(false);
	const [accountToRenew, setAccountToRenew] = useState<AccountItem | null>(
		null,
	);
	const [newRenewalDate, setNewRenewalDate] = useState("");
	const [newAccountExpiry, setNewAccountExpiry] = useState("");
	const [renewNotes, setRenewNotes] = useState("");

	// History Drawer
	const [historyOpen, setHistoryOpen] = useState(false);
	const [selectedHistoryAssetId, setSelectedHistoryAssetId] = useState<
		string | null
	>(null);

	// Filter digital accounts
	const accounts = assets.filter(
		(a) =>
			a.assetType === "digital_account" ||
			a.category === "digital_account" ||
			Boolean(a.renewalDate) ||
			Boolean(a.accountExpiry),
	);

	const handleOpenRenew = (account: AccountItem) => {
		setAccountToRenew(account);
		const baseDate = account.renewalDate
			? new Date(account.renewalDate)
			: new Date();
		const nextYear = new Date(baseDate.setFullYear(baseDate.getFullYear() + 1))
			.toISOString()
			.slice(0, 10);

		setNewRenewalDate(nextYear);
		setNewAccountExpiry("");
		setRenewNotes("");
		setRenewDialogOpen(true);
	};

	const handleConfirmRenew = (e: React.FormEvent) => {
		e.preventDefault();
		if (!accountToRenew) return;

		startTransition(async () => {
			try {
				const res = await renewAccount({
					data: {
						assetId: accountToRenew.id,
						newRenewalDate: newRenewalDate || null,
						newAccountExpiry: newAccountExpiry || null,
						notes: renewNotes.trim() || null,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success(`Account ${accountToRenew.name} renewed successfully!`);
					setRenewDialogOpen(false);
					onRefresh();
				}
			} catch (_err) {
				toast.error("Failed to renew account");
			}
		});
	};

	const copyText = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success("Copied to clipboard");
	};

	const getUrgency = (dateStr: string | null) => {
		if (!dateStr) {
			return {
				level: "none",
				label: "No Expiry",
				days: 999,
				badgeClass: "bg-muted text-muted-foreground border-transparent",
			};
		}

		const todayMs = new Date(today).getTime();
		const targetMs = new Date(dateStr).getTime();
		const diffDays = Math.ceil((targetMs - todayMs) / (1000 * 60 * 60 * 24));

		if (diffDays < 0) {
			return {
				level: "expired",
				label: `Expired ${Math.abs(diffDays)}d ago`,
				days: diffDays,
				badgeClass:
					"bg-destructive/10 text-destructive border-destructive/30 font-bold",
			};
		}
		if (diffDays <= 7) {
			return {
				level: "critical",
				label: `Expires in ${diffDays}d`,
				days: diffDays,
				badgeClass:
					"bg-destructive/10 text-destructive border-destructive/30 font-bold animate-pulse",
			};
		}
		if (diffDays <= 30) {
			return {
				level: "warning",
				label: `Renews in ${diffDays}d`,
				days: diffDays,
				badgeClass: "bg-warning/10 text-warning border-warning/30 font-medium",
			};
		}
		return {
			level: "good",
			label: `Renews in ${diffDays}d`,
			days: diffDays,
			badgeClass: "bg-success/10 text-success border-success/20",
		};
	};

	// Sort accounts by urgency (most urgent first)
	const sortedAccounts = [...accounts].sort((a, b) => {
		const dateA = a.renewalDate || a.accountExpiry || "9999-99-99";
		const dateB = b.renewalDate || b.accountExpiry || "9999-99-99";
		return dateA.localeCompare(dateB);
	});

	// Filter accounts
	const filteredAccounts = sortedAccounts.filter((account) => {
		const dateToCheck = account.renewalDate || account.accountExpiry;
		const urgency = getUrgency(dateToCheck);

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			const tagMatch = account.assetTag.toLowerCase().includes(q);
			const nameMatch = account.name.toLowerCase().includes(q);
			const serialMatch =
				account.serialNumber?.toLowerCase().includes(q) || false;
			const userMatch =
				account.currentAssignment?.userName?.toLowerCase().includes(q) || false;
			const companyMatch =
				account.ownerCompanyName?.toLowerCase().includes(q) || false;
			if (
				!tagMatch &&
				!nameMatch &&
				!serialMatch &&
				!userMatch &&
				!companyMatch
			)
				return false;
		}

		if (urgencyFilter !== "all") {
			if (urgencyFilter === "urgent") {
				if (urgency.level !== "critical" && urgency.level !== "expired")
					return false;
			} else if (urgencyFilter === "warning") {
				if (urgency.level !== "warning") return false;
			} else if (urgencyFilter === "good") {
				if (urgency.level !== "good") return false;
			} else if (urgencyFilter === "no_expiry") {
				if (urgency.level !== "none") return false;
			}
		}

		return true;
	});

	return (
		<div className="space-y-4">
			{/* High-density Filter Toolbar */}
			<DataTableToolbar>
				<DataTableFilters>
					{/* Search */}
					<div className="relative w-full sm:w-64">
						<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
						<Input
							placeholder="Search account, login, user..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 h-9"
						/>
					</div>

					{/* Urgency Filter */}
					<Select
						value={urgencyFilter}
						onValueChange={(val) => {
							if (val) setUrgencyFilter(val);
						}}
					>
						<SelectTrigger className="w-auto min-w-[160px] h-9">
							<SelectValue placeholder="Renewal Urgency">
								{(() => {
									if (urgencyFilter === "all") return "All Renewals";
									if (urgencyFilter === "urgent") return "Urgent (≤ 7 days)";
									if (urgencyFilter === "warning")
										return "Expiring (≤ 30 days)";
									if (urgencyFilter === "good") return "Active (> 30 days)";
									if (urgencyFilter === "no_expiry") return "No Expiry";
									return urgencyFilter;
								})()}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Renewals</SelectItem>
							<SelectItem value="urgent">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-destructive shrink-0" />
									<span>Urgent (≤ 7 days)</span>
								</div>
							</SelectItem>
							<SelectItem value="warning">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-warning shrink-0" />
									<span>Expiring (≤ 30 days)</span>
								</div>
							</SelectItem>
							<SelectItem value="good">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-success shrink-0" />
									<span>Active (&gt; 30 days)</span>
								</div>
							</SelectItem>
							<SelectItem value="no_expiry">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-muted-foreground shrink-0" />
									<span>No Expiry Set</span>
								</div>
							</SelectItem>
						</SelectContent>
					</Select>
				</DataTableFilters>

				<DataTableActions>
					<span className="text-xs text-muted-foreground">
						Showing <strong>{filteredAccounts.length}</strong> accounts (
						{accounts.length} total tracked)
					</span>
				</DataTableActions>
			</DataTableToolbar>

			{/* Compact Enterprise Table */}
			<DataTableContainer>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[140px]">Tag</TableHead>
							<TableHead className="w-[200px]">Account / Service</TableHead>
							<TableHead className="w-[170px]">Login / Identifier</TableHead>
							<TableHead className="w-[120px]">Owner</TableHead>
							<TableHead className="w-[180px]">Assigned To</TableHead>
							<TableHead className="w-[180px]">Renewal / Expiry</TableHead>
							<TableHead className="w-[130px] text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredAccounts.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={7}
									className="text-center h-32 text-muted-foreground text-sm"
								>
									No digital accounts match your search filters.
								</TableCell>
							</TableRow>
						) : (
							filteredAccounts.map((account) => {
								const dateToCheck =
									account.renewalDate || account.accountExpiry;
								const urgency = getUrgency(dateToCheck);

								return (
									<TableRow
										key={account.id}
										className="hover:bg-muted/40 transition-colors cursor-pointer"
										onClick={() => {
											setSelectedHistoryAssetId(account.id);
											setHistoryOpen(true);
										}}
									>
										{/* Tag */}
										<TableCell className="font-mono text-xs font-semibold py-3 align-top">
											<div className="space-y-0.5">
												<span className="text-foreground">
													{account.assetTag}
												</span>
												<div>
													<AssetCategoryBadge
														category={account.category as AssetCategory}
													/>
												</div>
											</div>
										</TableCell>

										{/* Account / Service */}
										<TableCell className="py-3 align-top">
											<div className="space-y-0.5">
												<span className="font-medium text-sm text-foreground block">
													{account.name}
												</span>
												{account.model && (
													<span className="text-xs text-muted-foreground block truncate max-w-[180px]">
														{account.model}
													</span>
												)}
											</div>
										</TableCell>

										{/* Login / Identifier */}
										<TableCell
											className="py-3 align-top font-mono text-xs"
											onClick={(e) => e.stopPropagation()}
										>
											{account.serialNumber ? (
												<button
													type="button"
													onClick={() => copyText(account.serialNumber || "")}
													className="text-muted-foreground flex items-center gap-1 hover:text-foreground cursor-pointer text-left"
													title="Click to copy identifier"
												>
													<span className="truncate max-w-[130px]">
														{account.serialNumber}
													</span>
													<Copy className="size-2.5 shrink-0" />
												</button>
											) : (
												<span className="text-muted-foreground italic">-</span>
											)}
										</TableCell>

										{/* Owner */}
										<TableCell className="py-3 align-top">
											<Badge
												variant={
													account.ownerCompanyIsInternal
														? "default"
														: "secondary"
												}
												className="font-mono text-[10px]"
											>
												{account.ownerCompanyCode || "Brainee.org"}
											</Badge>
										</TableCell>

										{/* Assigned To */}
										<TableCell className="py-3 align-top">
											{account.currentAssignment ? (
												<div className="flex items-center gap-2">
													<Avatar className="size-6 border border-border shrink-0">
														<AvatarImage
															src={
																account.currentAssignment.userAvatarUrl ||
																undefined
															}
														/>
														<AvatarFallback className="text-[10px]">
															{account.currentAssignment.userName
																?.substring(0, 2)
																.toUpperCase() || "U"}
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0 text-xs">
														<span className="font-medium text-foreground block truncate max-w-[130px]">
															{account.currentAssignment.userName}
														</span>
														<span className="text-[10px] text-muted-foreground block">
															Since{" "}
															{formatDateDisplay(
																new Date(
																	account.currentAssignment.assignedDate,
																),
															)}
														</span>
													</div>
												</div>
											) : (
												<span className="text-xs text-muted-foreground italic">
													Unassigned / Shared
												</span>
											)}
										</TableCell>

										{/* Renewal / Expiry */}
										<TableCell className="py-3 align-top text-xs">
											<div className="space-y-1">
												<Badge
													variant="outline"
													className={`text-[10px] font-mono ${urgency.badgeClass}`}
												>
													{urgency.label}
												</Badge>
												{dateToCheck && (
													<div className="text-[11px] text-muted-foreground">
														{formatDateDisplay(new Date(dateToCheck))}
													</div>
												)}
											</div>
										</TableCell>

										{/* Actions */}
										<TableCell
											className="py-3 align-top text-right"
											onClick={(e) => e.stopPropagation()}
										>
											<Button
												size="sm"
												variant="outline"
												className="h-7 text-xs gap-1 cursor-pointer"
												onClick={() => handleOpenRenew(account)}
											>
												<RefreshCw className="size-3" /> Quick Renew
											</Button>
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</DataTableContainer>

			{/* Modal: Renew Account Dialog */}
			<Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<RefreshCw className="size-4 text-muted-foreground" /> Renew
							Subscription / Account
						</DialogTitle>
						<DialogDescription>
							Update the renewal timestamp for{" "}
							<strong>{accountToRenew?.name}</strong> (
							{accountToRenew?.assetTag}).
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleConfirmRenew} className="space-y-4 py-1">
						<div className="space-y-1.5">
							<Label htmlFor="nextRenewal">Next Renewal Date *</Label>
							<Input
								id="nextRenewal"
								type="date"
								value={newRenewalDate}
								onChange={(e) => setNewRenewalDate(e.target.value)}
								required
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="nextExpiry">
								Hard Expiry Date{" "}
								<span className="text-muted-foreground text-xs font-normal">
									(Optional)
								</span>
							</Label>
							<Input
								id="nextExpiry"
								type="date"
								value={newAccountExpiry}
								onChange={(e) => setNewAccountExpiry(e.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="renewNotes">
								Renewal Notes / PO Reference{" "}
								<span className="text-muted-foreground text-xs font-normal">
									(Optional)
								</span>
							</Label>
							<Textarea
								id="renewNotes"
								rows={2}
								value={renewNotes}
								onChange={(e) => setRenewNotes(e.target.value)}
								placeholder="e.g. Annual seat renewal approved via Jira IT-204"
							/>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setRenewDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending || !newRenewalDate}>
								{isPending ? "Renewing..." : "Confirm Renewal"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* History Drawer */}
			<AssetHistoryDrawer
				assetId={selectedHistoryAssetId}
				open={historyOpen}
				onOpenChange={setHistoryOpen}
			/>
		</div>
	);
}
