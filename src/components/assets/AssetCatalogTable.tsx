import {
	AlertTriangle,
	ArrowDownToLine,
	ArrowLeftRight,
	ArrowUpRight,
	Ban,
	CheckCircle2,
	Clock,
	Copy,
	Eye,
	MoreHorizontal,
	Pencil,
	Plus,
	Search,
	Trash2,
	Wrench,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteAsset } from "@/api/assets";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { formatDateDisplay } from "@/lib/date-format";
import { AssetAssignDialog } from "./AssetAssignDialog";
import {
	type AssetCategory,
	AssetCategoryBadge,
	AssetTierBadge,
	CATEGORY_CONFIG,
	CATEGORY_OPTIONS,
} from "./AssetCategoryBadge";
import {
	AssetDefectReplaceDialog,
	type DefectActionType,
} from "./AssetDefectReplaceDialog";
import { AssetFormDialog } from "./AssetFormDialog";
import { AssetHistoryDrawer } from "./AssetHistoryDrawer";
import { AssetReturnDialog } from "./AssetReturnDialog";
import { AssetStatusBadge } from "./AssetStatusBadge";

interface AssetRow {
	id: string;
	assetTag: string;
	name: string;
	category: string;
	assetType: string;
	ownerCompanyId: string;
	ownerCompanyName: string | null;
	ownerCompanyCode: string | null;
	ownerCompanyIsInternal: boolean | null;
	serialNumber: string | null;
	model: string | null;
	specs: string | null;
	purchaseDate: string | null;
	purchaseCost: number | null;
	warrantyExpiry: string | null;
	accountExpiry: string | null;
	renewalDate: string | null;
	status: string;
	defectReason: string | null;
	disposalReason: string | null;
	disposalDate: string | null;
	notes: string | null;
	currentAssignment: {
		assignmentId: string;
		userId: string;
		userName: string | null;
		userEmail: string | null;
		userAvatarUrl: string | null;
		assignedDate: string;
		conditionOut: string;
		acknowledgedAt?: Date | string | null;
		issueReportedAt?: Date | string | null;
		issueDescription?: string | null;
		issueStatus?: string | null;
	} | null;
}

interface AssetCatalogTableProps {
	assets: AssetRow[];
	companies: Array<{
		id: string;
		name: string;
		code: string;
		isInternal: boolean;
	}>;
	users: Array<{
		id: string;
		name: string | null;
		email: string | null;
		role: string | null;
	}>;
	deployments: Array<{
		id: string;
		userId: string;
		userName: string | null;
		roleTitle: string | null;
		startDate: string;
	}>;
	today: string;
	onRefresh: () => void;
	initialStatusFilter?: string;
}

export function AssetCatalogTable({
	assets,
	companies,
	users,
	deployments,
	today,
	onRefresh,
	initialStatusFilter = "all",
}: AssetCatalogTableProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [tierFilter, setTierFilter] = useState("all");
	const [categoryFilter, setCategoryFilter] = useState("all");
	const [companyFilter, setCompanyFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState(initialStatusFilter);

	// Modals state
	const [formOpen, setFormOpen] = useState(false);
	const [assetToEdit, setAssetToEdit] = useState<AssetRow | null>(null);

	const [historyOpen, setHistoryOpen] = useState(false);
	const [selectedHistoryAssetId, setSelectedHistoryAssetId] = useState<
		string | null
	>(null);

	const [assignOpen, setAssignOpen] = useState(false);
	const [assetToAssign, setAssetToAssign] = useState<AssetRow | null>(null);

	const [returnOpen, setReturnOpen] = useState(false);
	const [assetToReturn, setAssetToReturn] = useState<AssetRow | null>(null);

	const [defectOpen, setDefectOpen] = useState(false);
	const [defectActionType, setDefectActionType] =
		useState<DefectActionType>("mark_defective");
	const [assetForDefect, setAssetForDefect] = useState<AssetRow | null>(null);

	// Filtering
	const filteredAssets = assets.filter((asset) => {
		// Tier filter
		if (tierFilter !== "all") {
			if (tierFilter === "capital_asset") {
				if (
					asset.assetType === "bulk_peripheral" ||
					asset.assetType === "digital_account"
				)
					return false;
			} else if (tierFilter === "bulk_peripheral") {
				if (
					asset.assetType !== "bulk_peripheral" &&
					asset.category !== "accessory" &&
					asset.category !== "charger" &&
					asset.category !== "bag"
				)
					return false;
			} else if (tierFilter === "digital_account") {
				if (
					asset.assetType !== "digital_account" &&
					asset.category !== "digital_account"
				)
					return false;
			}
		}

		// Status filter
		if (statusFilter === "in_inventory" && asset.status !== "in_inventory")
			return false;
		if (statusFilter === "assigned" && asset.status !== "assigned")
			return false;
		if (
			statusFilter === "defective" &&
			asset.status !== "defective" &&
			asset.status !== "maintenance"
		)
			return false;
		if (statusFilter === "disposed" && asset.status !== "disposed")
			return false;
		if (statusFilter === "expiring") {
			if (asset.assetType !== "digital_account") return false;
			const target = asset.renewalDate || asset.accountExpiry;
			if (!target) return false;
			const in30 = new Date(Date.now() + 30 * 86400000)
				.toISOString()
				.slice(0, 10);
			if (target > in30) return false;
		}

		// Category filter
		if (categoryFilter !== "all" && asset.category !== categoryFilter)
			return false;

		// Company filter
		if (companyFilter !== "all" && asset.ownerCompanyId !== companyFilter)
			return false;

		// Search query
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			const matchTag = asset.assetTag.toLowerCase().includes(q);
			const matchName = asset.name.toLowerCase().includes(q);
			const matchSerial =
				asset.serialNumber?.toLowerCase().includes(q) || false;
			const matchModel = asset.model?.toLowerCase().includes(q) || false;
			const matchUser =
				asset.currentAssignment?.userName?.toLowerCase().includes(q) || false;
			if (
				!matchTag &&
				!matchName &&
				!matchSerial &&
				!matchModel &&
				!matchUser
			) {
				return false;
			}
		}

		return true;
	});

	const copySerial = (e: React.MouseEvent, text: string) => {
		e.stopPropagation();
		navigator.clipboard.writeText(text);
		toast.success("Serial copied to clipboard");
	};

	const handleDelete = async (
		e: React.MouseEvent,
		assetId: string,
		tag: string,
	) => {
		e.stopPropagation();
		if (!confirm(`Are you sure you want to permanently delete asset ${tag}?`))
			return;

		try {
			const res = await deleteAsset({ data: { assetId } });
			if ("error" in res && res.error) {
				toast.error(res.error);
			} else {
				toast.success("Asset deleted");
				onRefresh();
			}
		} catch (_err) {
			toast.error("Failed to delete asset");
		}
	};

	return (
		<div className="space-y-4">
			{/* Toolbar & Filters */}
			<DataTableToolbar>
				<DataTableFilters>
					{/* Search */}
					<div className="relative w-full sm:w-64">
						<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
						<Input
							placeholder="Search tag, serial, employee..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 h-9"
						/>
					</div>

					{/* Asset Tier Filter */}
					<Select
						value={tierFilter}
						onValueChange={(val) => {
							if (val) setTierFilter(val);
						}}
					>
						<SelectTrigger className="w-auto min-w-[160px] h-9">
							<SelectValue placeholder="Asset Tier">
								{(() => {
									if (tierFilter === "all") return "All Tiers";
									if (tierFilter === "capital_asset") return "Capital Hardware";
									if (tierFilter === "bulk_peripheral")
										return "Peripherals / Stock";
									if (tierFilter === "digital_account")
										return "Digital Accounts";
									return tierFilter;
								})()}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Tiers</SelectItem>
							<SelectItem value="capital_asset">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-asset-capital shrink-0" />
									<span>Capital Hardware</span>
								</div>
							</SelectItem>
							<SelectItem value="bulk_peripheral">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-asset-peripheral shrink-0" />
									<span>Peripherals / Stock</span>
								</div>
							</SelectItem>
							<SelectItem value="digital_account">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-asset-digital shrink-0" />
									<span>Digital Accounts</span>
								</div>
							</SelectItem>
						</SelectContent>
					</Select>

					{/* Category */}
					<Select
						value={categoryFilter}
						onValueChange={(val) => {
							if (val) setCategoryFilter(val);
						}}
					>
						<SelectTrigger className="w-auto min-w-[145px] h-9">
							<SelectValue placeholder="Category">
								{categoryFilter === "all"
									? "All Categories"
									: CATEGORY_CONFIG[categoryFilter as AssetCategory]?.label ||
										categoryFilter}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Categories</SelectItem>
							{CATEGORY_OPTIONS.map((cat) => {
								const Icon = cat.icon;
								return (
									<SelectItem key={cat.value} value={cat.value}>
										<div className="flex items-center gap-2">
											<Icon className="size-3.5 text-muted-foreground shrink-0" />
											<span>{cat.label}</span>
										</div>
									</SelectItem>
								);
							})}
						</SelectContent>
					</Select>

					{/* Owner Company */}
					<Select
						value={companyFilter}
						onValueChange={(val) => {
							if (val) setCompanyFilter(val);
						}}
					>
						<SelectTrigger className="w-auto min-w-[140px] h-9">
							<SelectValue placeholder="Owner">
								{companyFilter === "all"
									? "All Owners"
									: companies.find((c) => c.id === companyFilter)?.name ||
										companyFilter}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Owners</SelectItem>
							{companies.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name} {c.isInternal ? "(Brainee.org)" : ""}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Status */}
					<Select
						value={statusFilter}
						onValueChange={(val) => {
							if (val) setStatusFilter(val);
						}}
					>
						<SelectTrigger className="w-auto min-w-[140px] h-9">
							<SelectValue placeholder="Status">
								{(() => {
									if (statusFilter === "all") return "All Statuses";
									if (statusFilter === "in_inventory") return "In Inventory";
									if (statusFilter === "assigned") return "Assigned";
									if (statusFilter === "defective") return "Defective / Maint";
									if (statusFilter === "disposed") return "Disposed";
									if (statusFilter === "expiring") return "Expiring Soon";
									return statusFilter;
								})()}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="in_inventory">
								<div className="flex items-center gap-2">
									<span className="size-2 rounded-full bg-success shrink-0" />
									<span>In Inventory</span>
								</div>
							</SelectItem>
							<SelectItem value="assigned">
								<div className="flex items-center gap-2">
									<span className="size-2 rounded-full bg-info shrink-0" />
									<span>Assigned</span>
								</div>
							</SelectItem>
							<SelectItem value="defective">
								<div className="flex items-center gap-2">
									<span className="size-2 rounded-full bg-destructive shrink-0" />
									<span>Defective / Maint</span>
								</div>
							</SelectItem>
							<SelectItem value="disposed">
								<div className="flex items-center gap-2">
									<span className="size-2 rounded-full bg-muted-foreground shrink-0" />
									<span>Disposed</span>
								</div>
							</SelectItem>
							<SelectItem value="expiring">
								<div className="flex items-center gap-2">
									<span className="size-2 rounded-full bg-warning shrink-0" />
									<span>Expiring Soon</span>
								</div>
							</SelectItem>
						</SelectContent>
					</Select>
				</DataTableFilters>

				<DataTableActions>
					<Button
						onClick={() => {
							setAssetToEdit(null);
							setFormOpen(true);
						}}
						className="gap-1.5"
						size="sm"
					>
						<Plus className="size-4" /> Add Item / Account
					</Button>
				</DataTableActions>
			</DataTableToolbar>

			{/* Table */}
			<DataTableContainer>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[170px]">Asset Tag / ID</TableHead>
							<TableHead>Item Name & Specs</TableHead>
							<TableHead>Category</TableHead>
							<TableHead>Owner</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Assigned To</TableHead>
							<TableHead>Warranty / Expiry</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredAssets.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={8}
									className="text-center h-32 text-muted-foreground text-sm"
								>
									No items found matching your filters.
								</TableCell>
							</TableRow>
						) : (
							filteredAssets.map((asset) => (
								<TableRow
									key={asset.id}
									className="cursor-pointer hover:bg-muted/40 transition-colors"
									onClick={() => {
										setSelectedHistoryAssetId(asset.id);
										setHistoryOpen(true);
									}}
								>
									{/* Tag & Serial */}
									<TableCell className="font-mono text-xs font-semibold">
										<div className="space-y-1">
											<div className="text-foreground flex items-center gap-1.5">
												<span>{asset.assetTag}</span>
											</div>
											<div className="flex items-center gap-1 flex-wrap">
												<AssetTierBadge tier={asset.assetType} />
												{asset.serialNumber && (
													<button
														type="button"
														className="text-[10px] text-muted-foreground flex items-center gap-0.5 hover:text-foreground cursor-pointer text-left"
														onClick={(e) =>
															copySerial(e, asset.serialNumber || "")
														}
														title="Click to copy serial"
													>
														<span className="truncate max-w-[90px]">
															{asset.serialNumber}
														</span>
														<Copy className="size-2.5 shrink-0" />
													</button>
												)}
											</div>
										</div>
									</TableCell>

									{/* Name & Specs */}
									<TableCell>
										<div className="space-y-0.5">
											<span className="font-medium text-sm text-foreground block">
												{asset.name}
											</span>
											{(asset.model || asset.specs) && (
												<span className="text-xs text-muted-foreground block truncate max-w-[220px]">
													{asset.model ? `${asset.model} · ` : ""}
													{asset.specs || ""}
												</span>
											)}
										</div>
									</TableCell>

									{/* Category */}
									<TableCell>
										<AssetCategoryBadge category={asset.category} />
									</TableCell>

									{/* Owner */}
									<TableCell>
										<Badge
											variant={
												asset.ownerCompanyIsInternal ? "default" : "secondary"
											}
											className="font-mono text-[11px]"
										>
											{asset.ownerCompanyCode || "Brainee.org"}
										</Badge>
									</TableCell>

									{/* Status */}
									<TableCell>
										<AssetStatusBadge status={asset.status} />
									</TableCell>

									{/* Assigned User */}
									<TableCell onClick={(e) => e.stopPropagation()}>
										{asset.currentAssignment ? (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<Avatar className="size-6 border border-border">
														<AvatarImage
															src={
																asset.currentAssignment.userAvatarUrl ||
																undefined
															}
														/>
														<AvatarFallback className="text-[10px]">
															{asset.currentAssignment.userName
																?.substring(0, 2)
																.toUpperCase() || "U"}
														</AvatarFallback>
													</Avatar>
													<div className="text-xs">
														<span className="font-medium text-foreground block truncate max-w-[120px]">
															{asset.currentAssignment.userName || "Unknown"}
														</span>
														<span className="text-[10px] text-muted-foreground">
															Since{" "}
															{formatDateDisplay(
																new Date(asset.currentAssignment.assignedDate),
															)}
														</span>
													</div>
												</div>

												{/* Acknowledgment & Issue Status Indicator */}
												<div>
													{asset.currentAssignment.issueStatus === "open" ? (
														<span className="inline-flex items-center gap-1 text-[10px] text-warning font-medium bg-warning/10 px-1.5 py-0.5 rounded border border-warning/30">
															<AlertTriangle className="size-2.5 shrink-0" />{" "}
															Issue reported
														</span>
													) : asset.currentAssignment.acknowledgedAt ? (
														<span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
															<CheckCircle2 className="size-2.5 shrink-0" />{" "}
															Signed off
														</span>
													) : (
														<span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
															<Clock className="size-2.5 shrink-0" /> Awaiting
															sign-off
														</span>
													)}
												</div>
											</div>
										) : (
											<span className="text-xs text-muted-foreground italic">
												Unassigned
											</span>
										)}
									</TableCell>

									{/* Warranty / Expiry */}
									<TableCell className="text-xs">
										{asset.assetType === "digital_account" ? (
											asset.renewalDate ? (
												<span className="text-warning font-medium">
													Renews{" "}
													{formatDateDisplay(new Date(asset.renewalDate))}
												</span>
											) : (
												<span className="text-muted-foreground">-</span>
											)
										) : asset.warrantyExpiry ? (
											<span>
												{formatDateDisplay(new Date(asset.warrantyExpiry))}
											</span>
										) : (
											<span className="text-muted-foreground">-</span>
										)}
									</TableCell>

									{/* Actions */}
									<TableCell
										className="text-right"
										onClick={(e) => e.stopPropagation()}
									>
										<DropdownMenu>
											<DropdownMenuTrigger
												render={
													<Button
														variant="ghost"
														size="sm"
														className="size-8 p-0"
													>
														<MoreHorizontal className="size-4" />
													</Button>
												}
											/>
											<DropdownMenuContent align="end" className="w-48">
												<DropdownMenuLabel className="text-xs text-muted-foreground">
													{asset.assetTag}
												</DropdownMenuLabel>
												<DropdownMenuItem
													onClick={() => {
														setSelectedHistoryAssetId(asset.id);
														setHistoryOpen(true);
													}}
													className="gap-2 text-xs"
												>
													<Eye className="size-3.5" /> View History Timeline
												</DropdownMenuItem>

												<DropdownMenuSeparator />

												{/* Assignment Options */}
												{asset.status === "in_inventory" && (
													<DropdownMenuItem
														onClick={() => {
															setAssetToAssign(asset);
															setAssignOpen(true);
														}}
														className="gap-2 text-xs text-info"
													>
														<ArrowUpRight className="size-3.5" /> Assign to
														Employee
													</DropdownMenuItem>
												)}

												{asset.status === "assigned" && (
													<>
														<DropdownMenuItem
															onClick={() => {
																setAssetToReturn(asset);
																setReturnOpen(true);
															}}
															className="gap-2 text-xs text-info"
														>
															<ArrowDownToLine className="size-3.5" /> Return &
															Check-in
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() => {
																setAssetToAssign(asset);
																setAssignOpen(true);
															}}
															className="gap-2 text-xs"
														>
															<ArrowLeftRight className="size-3.5" /> Reassign /
															Transfer
														</DropdownMenuItem>
													</>
												)}

												<DropdownMenuSeparator />

												{/* Lifecycle & Status Options */}
												<DropdownMenuItem
													onClick={() => {
														setAssetForDefect(asset);
														setDefectActionType("mark_defective");
														setDefectOpen(true);
													}}
													className="gap-2 text-xs text-destructive"
												>
													<AlertTriangle className="size-3.5" /> Mark Defective
												</DropdownMenuItem>

												{asset.status !== "maintenance" ? (
													<DropdownMenuItem
														onClick={() => {
															setAssetForDefect(asset);
															setDefectActionType("maintenance");
															setDefectOpen(true);
														}}
														className="gap-2 text-xs text-warning"
													>
														<Wrench className="size-3.5" /> Send to Maintenance
													</DropdownMenuItem>
												) : (
													<DropdownMenuItem
														onClick={() => {
															setAssetForDefect(asset);
															setDefectActionType("resolve_maintenance");
															setDefectOpen(true);
														}}
														className="gap-2 text-xs text-success"
													>
														<Wrench className="size-3.5" /> Complete Maintenance
													</DropdownMenuItem>
												)}

												<DropdownMenuItem
													onClick={() => {
														setAssetForDefect(asset);
														setDefectActionType("replace");
														setDefectOpen(true);
													}}
													className="gap-2 text-xs text-status-holiday-foreground"
												>
													<ArrowLeftRight className="size-3.5" /> Replace Asset
												</DropdownMenuItem>

												<DropdownMenuItem
													onClick={() => {
														setAssetForDefect(asset);
														setDefectActionType("dispose");
														setDefectOpen(true);
													}}
													className="gap-2 text-xs text-muted-foreground"
												>
													<Ban className="size-3.5" /> Dispose / Scrap
												</DropdownMenuItem>

												<DropdownMenuSeparator />

												{/* Edit & Delete */}
												<DropdownMenuItem
													onClick={() => {
														setAssetToEdit(asset);
														setFormOpen(true);
													}}
													className="gap-2 text-xs"
												>
													<Pencil className="size-3.5" /> Edit Details
												</DropdownMenuItem>

												{!asset.currentAssignment && (
													<DropdownMenuItem
														onClick={(e) =>
															handleDelete(e, asset.id, asset.assetTag)
														}
														className="gap-2 text-xs text-destructive focus:text-destructive"
													>
														<Trash2 className="size-3.5" /> Delete
													</DropdownMenuItem>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</DataTableContainer>

			{/* Dialogs */}
			<AssetFormDialog
				open={formOpen}
				onOpenChange={setFormOpen}
				assetToEdit={assetToEdit}
				companies={companies}
				onSuccess={onRefresh}
			/>

			<AssetAssignDialog
				open={assignOpen}
				onOpenChange={setAssignOpen}
				asset={assetToAssign}
				users={users}
				deployments={deployments}
				today={today}
				onSuccess={onRefresh}
			/>

			<AssetReturnDialog
				open={returnOpen}
				onOpenChange={setReturnOpen}
				asset={assetToReturn}
				today={today}
				onSuccess={onRefresh}
			/>

			<AssetDefectReplaceDialog
				open={defectOpen}
				onOpenChange={setDefectOpen}
				actionType={defectActionType}
				asset={assetForDefect}
				availableAssets={assets}
				onSuccess={onRefresh}
			/>

			<AssetHistoryDrawer
				open={historyOpen}
				onOpenChange={setHistoryOpen}
				assetId={selectedHistoryAssetId}
			/>
		</div>
	);
}
