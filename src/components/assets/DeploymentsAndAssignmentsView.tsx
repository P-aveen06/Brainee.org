import {
	AlertTriangle,
	ArrowDownToLine,
	CheckCircle2,
	ChevronRight,
	Clock,
	LogOut,
	Pencil,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
	createClientDeployment,
	deleteClientDeployment,
	offboardClientDeployment,
	updateClientDeployment,
} from "@/api/deployments";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { AssetAssignDialog } from "./AssetAssignDialog";
import { type AssetCategory, AssetCategoryBadge } from "./AssetCategoryBadge";
import { AssetHistoryDrawer } from "./AssetHistoryDrawer";
import { AssetReturnDialog } from "./AssetReturnDialog";

export interface ClientDeploymentItem {
	id: string;
	userId: string;
	userName: string | null;
	userEmail: string | null;
	userAvatarUrl: string | null;
	primaryClientId: string;
	primaryCompanyName: string;
	primaryCompanyCode: string;
	primaryCompanyIsInternal?: boolean | null;
	endClientId: string | null;
	endCompanyName: string | null;
	endCompanyCode: string | null;
	endCompanyIsInternal?: boolean | null;
	roleTitle: string | null;
	startDate: string;
	endDate: string | null;
	status: string;
	notes: string | null;
	assignedAssets: Array<{
		assignmentId: string;
		assetId: string;
		assetTag: string;
		assetName: string;
		assetCategory: string;
		assetType: string;
		ownerCompanyId: string;
		ownerCompanyName: string;
		serialNumber: string | null;
		accountExpiry: string | null;
		renewalDate: string | null;
		specs?: string | null;
		assignedDate?: string;
	}>;
}

export interface AssignedAssetItem {
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
	status: string;
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

interface DeploymentsAndAssignmentsViewProps {
	deployments: ClientDeploymentItem[];
	assets: AssignedAssetItem[];
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
		avatarUrl?: string | null;
		role: string | null;
	}>;
	availableAssets: Array<{
		id: string;
		assetTag: string;
		name: string;
		category: string;
		assetType: string;
		ownerCompanyId: string;
		ownerCompanyName: string | null;
		ownerCompanyCode?: string | null;
	}>;
	today: string;
	onRefresh: () => void;
}

export function DeploymentsAndAssignmentsView({
	deployments,
	assets,
	companies,
	users,
	availableAssets,
	today,
	onRefresh,
}: DeploymentsAndAssignmentsViewProps) {
	const [isPending, startTransition] = useTransition();

	// Filters
	const [searchQuery, setSearchQuery] = useState("");
	const [deploymentFilter, setDeploymentFilter] = useState("all");
	const [custodyFilter, setCustodyFilter] = useState("all");

	// Deploy Dialog (Create)
	const [deployDialogOpen, setDeployDialogOpen] = useState(false);
	const [deployUserId, setDeployUserId] = useState(users[0]?.id || "");
	const [deployPrimaryClientId, setDeployPrimaryClientId] = useState(
		companies.find((c) => !c.isInternal)?.id || companies[0]?.id || "",
	);
	const [deployEndClientId, setDeployEndClientId] = useState("none");
	const [deployRoleTitle, setDeployRoleTitle] = useState("");
	const [deployStartDate, setDeployStartDate] = useState(today);
	const [deployEndDate, setDeployEndDate] = useState("");
	const [deployNotes, setDeployNotes] = useState("");
	const [selectedBundleAssetIds, setSelectedBundleAssetIds] = useState<
		string[]
	>([]);

	// Edit Engagement Dialog
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editingDeployment, setEditingDeployment] =
		useState<ClientDeploymentItem | null>(null);
	const [editPrimaryClientId, setEditPrimaryClientId] = useState("");
	const [editEndClientId, setEditEndClientId] = useState("none");
	const [editRoleTitle, setEditRoleTitle] = useState("");
	const [editStartDate, setEditStartDate] = useState("");
	const [editEndDate, setEditEndDate] = useState("");
	const [editStatus, setEditStatus] = useState<
		"active" | "completed" | "terminated"
	>("active");
	const [editNotes, setEditNotes] = useState("");

	// Offboard Clearance Dialog
	const [offboardDialogOpen, setOffboardDialogOpen] = useState(false);
	const [deploymentToOffboard, setDeploymentToOffboard] =
		useState<ClientDeploymentItem | null>(null);
	const [offboardDate, setOffboardDate] = useState(today);
	const [offboardReason, setOffboardReason] = useState("");
	const [assetsToReturnSelection, setAssetsToReturnSelection] = useState<
		Record<string, boolean>
	>({});

	// Modals for gear
	const [assignDialogOpen, setAssignDialogOpen] = useState(false);
	const [assetToAssign, setAssetToAssign] = useState<AssignedAssetItem | null>(
		null,
	);
	const [selectedUserIdForAssign, setSelectedUserIdForAssign] =
		useState<string>("");

	const [returnDialogOpen, setReturnDialogOpen] = useState(false);
	const [assetToReturn, setAssetToReturn] = useState<AssignedAssetItem | null>(
		null,
	);

	const [historyOpen, setHistoryOpen] = useState(false);
	const [selectedHistoryAssetId, setSelectedHistoryAssetId] = useState<
		string | null
	>(null);

	// Helpers
	const cleanCompanyName = (name?: string | null) => {
		if (!name) return "";
		return name.replace(/\s*\([^)]*\)$/, "").trim();
	};

	// Map active deployments by user
	const userActiveDeploymentMap = new Map<string, ClientDeploymentItem>();
	for (const dep of deployments) {
		if (dep.status === "active") {
			userActiveDeploymentMap.set(dep.userId, dep);
		}
	}

	// Map all assigned assets by user
	const userAssetsMap = new Map<string, AssignedAssetItem[]>();
	for (const asset of assets) {
		if (asset.status === "assigned" && asset.currentAssignment?.userId) {
			const uid = asset.currentAssignment.userId;
			const list = userAssetsMap.get(uid) || [];
			list.push(asset);
			userAssetsMap.set(uid, list);
		}
	}

	// Users map
	const userMap = new Map<string, (typeof users)[0]>();
	for (const u of users) {
		userMap.set(u.id, u);
	}

	// Build population of relevant employees
	// (anyone with an active deployment OR holding assigned gear, plus anyone matching a search query)
	const activeUserIds = new Set<string>();
	for (const dep of deployments) {
		if (dep.status === "active") activeUserIds.add(dep.userId);
	}
	for (const [uid, uAssets] of userAssetsMap.entries()) {
		if (uAssets.length > 0) activeUserIds.add(uid);
	}

	// Filter employee records
	const filteredEmployees = users
		.filter((user) => {
			const activeDep = userActiveDeploymentMap.get(user.id);
			const userAssets = userAssetsMap.get(user.id) || [];
			const isRelevant =
				activeUserIds.has(user.id) || searchQuery.trim().length > 0;

			if (!isRelevant) return false;

			// Search Query
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const nameMatch = user.name?.toLowerCase().includes(q) || false;
				const emailMatch = user.email?.toLowerCase().includes(q) || false;
				const roleMatch =
					user.role?.toLowerCase().includes(q) ||
					activeDep?.roleTitle?.toLowerCase().includes(q) ||
					false;
				const clientMatch =
					activeDep?.primaryCompanyName?.toLowerCase().includes(q) ||
					activeDep?.endCompanyName?.toLowerCase().includes(q) ||
					false;
				const assetMatch = userAssets.some(
					(a) =>
						a.assetTag.toLowerCase().includes(q) ||
						a.name.toLowerCase().includes(q) ||
						a.serialNumber?.toLowerCase().includes(q),
				);
				if (
					!nameMatch &&
					!emailMatch &&
					!roleMatch &&
					!clientMatch &&
					!assetMatch
				)
					return false;
			}

			// Deployment Filter
			if (deploymentFilter !== "all") {
				if (deploymentFilter === "client_active") {
					if (!activeDep) return false;
				} else if (deploymentFilter === "internal") {
					if (activeDep) return false;
				} else {
					// Specific company id or name
					const matchesComp =
						activeDep?.primaryClientId === deploymentFilter ||
						activeDep?.endClientId === deploymentFilter ||
						activeDep?.primaryCompanyName
							?.toLowerCase()
							.includes(deploymentFilter.toLowerCase()) ||
						activeDep?.endCompanyName
							?.toLowerCase()
							.includes(deploymentFilter.toLowerCase());
					if (!matchesComp) return false;
				}
			}

			// Custody Status Filter
			if (custodyFilter !== "all") {
				if (custodyFilter === "signed_off") {
					if (userAssets.length === 0) return false;
					const allConfirmed = userAssets.every((a) =>
						Boolean(a.currentAssignment?.acknowledgedAt),
					);
					if (!allConfirmed) return false;
				} else if (custodyFilter === "pending") {
					if (userAssets.length === 0) return false;
					const hasPending = userAssets.some(
						(a) => !a.currentAssignment?.acknowledgedAt,
					);
					if (!hasPending) return false;
				} else if (custodyFilter === "issue") {
					const hasIssue = userAssets.some(
						(a) =>
							a.currentAssignment?.issueStatus === "open" ||
							a.currentAssignment?.issueStatus === "investigating",
					);
					if (!hasIssue) return false;
				}
			}

			return true;
		})
		.sort((a, b) => {
			// Sort: employees with client deployments first, then by name
			const depA = userActiveDeploymentMap.has(a.id) ? 1 : 0;
			const depB = userActiveDeploymentMap.has(b.id) ? 1 : 0;
			if (depB !== depA) return depB - depA;
			return (a.name || "").localeCompare(b.name || "");
		});

	// Handlers for Deploy Dialog
	const handleOpenDeploy = (targetUserId?: string) => {
		setDeployUserId(targetUserId || users[0]?.id || "");
		const client = companies.find((c) => !c.isInternal) || companies[0];
		setDeployPrimaryClientId(client?.id || "");
		setDeployEndClientId("none");
		setDeployRoleTitle("");
		setDeployStartDate(today);
		setDeployEndDate("");
		setDeployNotes("");
		setSelectedBundleAssetIds([]);
		setDeployDialogOpen(true);
	};

	const handleCreateDeploy = (e: React.FormEvent) => {
		e.preventDefault();
		if (!deployUserId || !deployPrimaryClientId) {
			toast.error("Please select an employee and primary client company.");
			return;
		}

		startTransition(async () => {
			try {
				const res = await createClientDeployment({
					data: {
						userId: deployUserId,
						primaryClientId: deployPrimaryClientId,
						endClientId:
							deployEndClientId === "none" ? null : deployEndClientId,
						roleTitle: deployRoleTitle.trim() || null,
						startDate: deployStartDate,
						endDate: deployEndDate || null,
						notes: deployNotes.trim() || null,
						bundleAssetIds: selectedBundleAssetIds,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Employee deployed to client successfully");
					setDeployDialogOpen(false);
					onRefresh();
				}
			} catch (_err) {
				toast.error("Failed to create client deployment");
			}
		});
	};

	// Handlers for Edit Engagement
	const handleOpenEdit = (dep: ClientDeploymentItem) => {
		setEditingDeployment(dep);
		setEditPrimaryClientId(dep.primaryClientId);
		setEditEndClientId(dep.endClientId || "none");
		setEditRoleTitle(dep.roleTitle || "");
		setEditStartDate(dep.startDate);
		setEditEndDate(dep.endDate || "");
		setEditStatus(
			(dep.status as "active" | "completed" | "terminated") || "active",
		);
		setEditNotes(dep.notes || "");
		setEditDialogOpen(true);
	};

	const handleUpdateDeploy = (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingDeployment || !editPrimaryClientId) return;

		startTransition(async () => {
			try {
				const res = await updateClientDeployment({
					data: {
						id: editingDeployment.id,
						primaryClientId: editPrimaryClientId,
						endClientId: editEndClientId === "none" ? null : editEndClientId,
						roleTitle: editRoleTitle.trim() || null,
						startDate: editStartDate,
						endDate: editEndDate || null,
						status: editStatus,
						notes: editNotes.trim() || null,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Engagement updated successfully");
					setEditDialogOpen(false);
					onRefresh();
				}
			} catch (_err) {
				toast.error("Failed to update engagement");
			}
		});
	};

	// Handlers for Offboard Clearance
	const handleOpenOffboard = (dep: ClientDeploymentItem) => {
		setDeploymentToOffboard(dep);
		setOffboardDate(today);
		setOffboardReason("");
		const initialSel: Record<string, boolean> = {};
		for (const a of dep.assignedAssets) {
			initialSel[a.assetId] = true;
		}
		setAssetsToReturnSelection(initialSel);
		setOffboardDialogOpen(true);
	};

	const handleConfirmOffboard = (e: React.FormEvent) => {
		e.preventDefault();
		if (!deploymentToOffboard) return;

		const returnAssetIds = Object.entries(assetsToReturnSelection)
			.filter(([_, checked]) => checked)
			.map(([id]) => id);

		startTransition(async () => {
			try {
				const res = await offboardClientDeployment({
					data: {
						deploymentId: deploymentToOffboard.id,
						endDate: offboardDate,
						reason: offboardReason.trim() || null,
						returnAssetIds,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success(
						"Client offboarding completed! Brainee.org items returned to inventory.",
					);
					setOffboardDialogOpen(false);
					onRefresh();
				}
			} catch (_err) {
				toast.error("Failed to process offboarding");
			}
		});
	};

	// Handlers for Delete Deployment
	const handleDeleteDeployment = (dep: ClientDeploymentItem) => {
		if (
			!window.confirm(
				`Are you sure you want to delete the engagement for ${dep.userName}?`,
			)
		) {
			return;
		}

		startTransition(async () => {
			try {
				const res = await deleteClientDeployment({ data: { id: dep.id } });
				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Deployment deleted");
					onRefresh();
				}
			} catch (_err) {
				toast.error("Failed to delete deployment");
			}
		});
	};

	// Handlers for Gear Assignment & Return
	const handleOpenAssignGear = (userId: string) => {
		setSelectedUserIdForAssign(userId);
		const firstAvailable = availableAssets[0];
		if (firstAvailable) {
			setAssetToAssign({
				id: firstAvailable.id,
				assetTag: firstAvailable.assetTag,
				name: firstAvailable.name,
				category: firstAvailable.category,
				assetType: firstAvailable.assetType,
				ownerCompanyId: firstAvailable.ownerCompanyId,
				ownerCompanyName: firstAvailable.ownerCompanyName,
				ownerCompanyCode: firstAvailable.ownerCompanyCode || null,
				ownerCompanyIsInternal: true,
				serialNumber: null,
				status: "in_inventory",
				currentAssignment: null,
			});
			setAssignDialogOpen(true);
		} else {
			toast.info(
				"No inventory items available to assign. Add or return equipment first.",
			);
		}
	};

	const handleOpenReturnAsset = (asset: AssignedAssetItem) => {
		setAssetToReturn(asset);
		setReturnDialogOpen(true);
	};

	const toggleBundleAsset = (assetId: string) => {
		if (selectedBundleAssetIds.includes(assetId)) {
			setSelectedBundleAssetIds(
				selectedBundleAssetIds.filter((id) => id !== assetId),
			);
		} else {
			setSelectedBundleAssetIds([...selectedBundleAssetIds, assetId]);
		}
	};

	return (
		<div className="space-y-4">
			{/* High-density Filter Toolbar */}
			<DataTableToolbar>
				<DataTableFilters>
					{/* Search */}
					<div className="relative w-full sm:w-64">
						<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
						<Input
							placeholder="Search employee, client, asset..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 h-9"
						/>
					</div>

					{/* Deployment / Project Filter */}
					<Select
						value={deploymentFilter}
						onValueChange={(val) => {
							if (val) setDeploymentFilter(val);
						}}
					>
						<SelectTrigger className="w-auto min-w-[170px] h-9">
							<SelectValue placeholder="Engagement">
								{(() => {
									if (deploymentFilter === "all") return "All Engagements";
									if (deploymentFilter === "client_active")
										return "Client Deployments";
									if (deploymentFilter === "internal")
										return "Internal (Brainee.org Only)";
									return deploymentFilter;
								})()}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Engagements</SelectItem>
							<SelectItem value="client_active">
								Active Client Deployments
							</SelectItem>
							<SelectItem value="internal">Internal (Brainee.org Only)</SelectItem>
							{companies
								.filter((c) => !c.isInternal)
								.map((c) => (
									<SelectItem key={c.id} value={c.name}>
										{cleanCompanyName(c.name)}
									</SelectItem>
								))}
						</SelectContent>
					</Select>

					{/* Custody Sign-off Filter */}
					<Select
						value={custodyFilter}
						onValueChange={(val) => {
							if (val) setCustodyFilter(val);
						}}
					>
						<SelectTrigger className="w-auto min-w-[160px] h-9">
							<SelectValue placeholder="Custody Status">
								{(() => {
									if (custodyFilter === "all") return "All Custody Status";
									if (custodyFilter === "signed_off") return "All Signed Off";
									if (custodyFilter === "pending") return "Pending Sign-off";
									if (custodyFilter === "issue") return "Has Open Issues";
									return custodyFilter;
								})()}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Custody Status</SelectItem>
							<SelectItem value="signed_off">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-success shrink-0" />
									<span>All Signed Off</span>
								</div>
							</SelectItem>
							<SelectItem value="pending">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-warning shrink-0" />
									<span>Pending Sign-off</span>
								</div>
							</SelectItem>
							<SelectItem value="issue">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-destructive shrink-0" />
									<span>Has Open Issues</span>
								</div>
							</SelectItem>
						</SelectContent>
					</Select>
				</DataTableFilters>

				<DataTableActions>
					<Button
						onClick={() => handleOpenDeploy()}
						className="gap-1.5 cursor-pointer"
						size="sm"
					>
						<Plus className="size-4" /> Deploy Employee to Client
					</Button>
				</DataTableActions>
			</DataTableToolbar>

			{/* Unified Enterprise Table */}
			<DataTableContainer>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[210px]">Employee</TableHead>
							<TableHead className="w-[200px]">Engagement / Route</TableHead>
							<TableHead>Assigned Gear & Accounts</TableHead>
							<TableHead className="w-[140px]">Custody Status</TableHead>
							<TableHead className="w-[180px] text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredEmployees.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={5}
									className="text-center h-32 text-muted-foreground text-sm"
								>
									No employee deployments or assignments match your search
									filters.
								</TableCell>
							</TableRow>
						) : (
							filteredEmployees.map((user) => {
								const activeDep = userActiveDeploymentMap.get(user.id);
								const userAssets = userAssetsMap.get(user.id) || [];
								const hasOpenIssue = userAssets.some(
									(a) =>
										a.currentAssignment?.issueStatus === "open" ||
										a.currentAssignment?.issueStatus === "investigating",
								);
								const allAcknowledged =
									userAssets.length > 0 &&
									userAssets.every((a) =>
										Boolean(a.currentAssignment?.acknowledgedAt),
									);

								return (
									<TableRow
										key={user.id}
										className="hover:bg-muted/40 transition-colors"
									>
										{/* Employee Column */}
										<TableCell className="align-top py-3">
											<div className="flex items-start gap-2.5">
												<Avatar className="size-8 border border-border mt-0.5">
													<AvatarImage src={user.avatarUrl || undefined} />
													<AvatarFallback className="text-[11px] font-semibold">
														{user.name?.substring(0, 2).toUpperCase() || "U"}
													</AvatarFallback>
												</Avatar>
												<div className="min-w-0">
													<span className="font-semibold text-xs text-foreground block truncate">
														{user.name || "Unknown"}
													</span>
													<span className="text-[11px] text-muted-foreground block truncate">
														{user.email}
													</span>
													<Badge
														variant="outline"
														className="text-[10px] capitalize font-mono mt-1 h-4 px-1"
													>
														{user.role || "employee"}
													</Badge>
												</div>
											</div>
										</TableCell>

										{/* Engagement / Route Column */}
										<TableCell className="align-top py-3 text-xs">
											{activeDep ? (
												<div className="space-y-1">
													<div className="flex items-center gap-1 font-semibold text-foreground flex-wrap">
														<span>Brainee.org</span>
														<ChevronRight className="size-3 text-muted-foreground/60" />
														<span className="text-primary font-semibold">
															{cleanCompanyName(
																activeDep.endCompanyName ||
																	activeDep.primaryCompanyName,
															)}
														</span>
													</div>
													<div className="text-[10px] text-muted-foreground">
														<span className="font-medium text-foreground block">
															{activeDep.roleTitle || "Client Project"}
														</span>
														<span>
															Since{" "}
															{formatDateDisplay(new Date(activeDep.startDate))}
														</span>
													</div>
												</div>
											) : (
												<div className="space-y-1">
													<Badge
														variant="secondary"
														className="font-mono text-[10px] bg-muted/60"
													>
														Internal (Brainee.org)
													</Badge>
													<span className="text-[10px] text-muted-foreground block">
														Direct Operations
													</span>
												</div>
											)}
										</TableCell>

										{/* Assigned Gear & Accounts Column */}
										<TableCell className="align-top py-3">
											<div className="space-y-1.5">
												<div className="flex items-center justify-between gap-1">
													<span className="text-[11px] font-semibold text-foreground">
														{userAssets.length}{" "}
														{userAssets.length === 1 ? "Item" : "Items"} in
														Custody
													</span>
													<button
														type="button"
														onClick={() => handleOpenAssignGear(user.id)}
														className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
													>
														+ Assign Gear
													</button>
												</div>

												{userAssets.length === 0 ? (
													<span className="text-xs text-muted-foreground italic block pt-0.5">
														No equipment checked out
													</span>
												) : (
													<div className="flex flex-wrap gap-1">
														{userAssets.map((item) => (
															<div
																key={item.id}
																className="inline-flex items-center gap-1.5 rounded border border-border/60 bg-muted/30 px-2 py-0.5 text-xs hover:bg-muted/60 transition-colors"
															>
																<button
																	type="button"
																	onClick={() => {
																		setSelectedHistoryAssetId(item.id);
																		setHistoryOpen(true);
																	}}
																	className="font-mono font-bold text-foreground hover:underline cursor-pointer"
																	title="View history"
																>
																	{item.assetTag}
																</button>
																<AssetCategoryBadge
																	category={item.category as AssetCategory}
																/>
																<span className="text-muted-foreground truncate max-w-[120px]">
																	{item.name}
																</span>
																<Button
																	variant="ghost"
																	size="icon"
																	className="size-4 text-muted-foreground hover:text-info cursor-pointer -mr-0.5"
																	title="Return asset"
																	onClick={() => handleOpenReturnAsset(item)}
																>
																	<ArrowDownToLine className="size-2.5" />
																</Button>
															</div>
														))}
													</div>
												)}
											</div>
										</TableCell>

										{/* Custody Sign-off Column */}
										<TableCell className="align-top py-3">
											{userAssets.length === 0 ? (
												<span className="text-xs text-muted-foreground">-</span>
											) : hasOpenIssue ? (
												<Badge
													variant="outline"
													className="text-[10px] text-destructive bg-destructive/10 border-destructive/30 gap-1 font-medium"
												>
													<AlertTriangle className="size-3 shrink-0" /> Open
													Issue
												</Badge>
											) : allAcknowledged ? (
												<Badge
													variant="outline"
													className="text-[10px] text-success bg-success/10 border-success/20 gap-1 font-medium"
												>
													<CheckCircle2 className="size-3 shrink-0" /> Signed
													Off
												</Badge>
											) : (
												<Badge
													variant="outline"
													className="text-[10px] text-warning bg-warning/10 border-warning/30 gap-1 font-medium"
												>
													<Clock className="size-3 shrink-0" /> Pending Sign-off
												</Badge>
											)}
										</TableCell>

										{/* Actions Column */}
										<TableCell className="align-top py-3 text-right">
											<div className="flex items-center justify-end gap-1">
												{activeDep ? (
													<>
														<Button
															variant="ghost"
															size="sm"
															className="h-7 px-2 text-xs gap-1 cursor-pointer"
															onClick={() => handleOpenEdit(activeDep)}
														>
															<Pencil className="size-3" /> Edit
														</Button>

														<Button
															variant="ghost"
															size="sm"
															className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 cursor-pointer"
															onClick={() => handleOpenOffboard(activeDep)}
														>
															<LogOut className="size-3" /> Offboard
														</Button>

														<DropdownMenu>
															<DropdownMenuTrigger
																render={
																	<Button
																		variant="ghost"
																		size="sm"
																		className="size-7 p-0 text-muted-foreground cursor-pointer"
																	>
																		<Trash2 className="size-3.5" />
																	</Button>
																}
															/>
															<DropdownMenuContent align="end">
																<DropdownMenuItem
																	onClick={() =>
																		handleDeleteDeployment(activeDep)
																	}
																	className="text-xs text-destructive focus:text-destructive gap-2 cursor-pointer"
																>
																	<Trash2 className="size-3.5" /> Delete
																	Engagement
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</>
												) : (
													<Button
														variant="outline"
														size="sm"
														className="h-7 px-2 text-xs gap-1 cursor-pointer"
														onClick={() => handleOpenDeploy(user.id)}
													>
														<Plus className="size-3" /> Deploy
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</DataTableContainer>

			{/* Modal: Deploy Employee to Client */}
			<Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
				<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Deploy Employee to Client Project</DialogTitle>
						<DialogDescription>
							Assign an employee to a client engagement, track their project
							role, and bundle initial hardware & credentials.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleCreateDeploy} className="space-y-4.5 py-1">
						{/* Employee */}
						<div className="space-y-1.5">
							<Label htmlFor="deployEmployee">Employee *</Label>
							<Select
								value={deployUserId}
								onValueChange={(val) => {
									if (val) setDeployUserId(val);
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select employee">
										{(() => {
											const u = users.find((user) => user.id === deployUserId);
											return u
												? `${u.name || "Unknown"} (${u.email})`
												: "Select employee";
										})()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{users.map((u) => (
										<SelectItem key={u.id} value={u.id}>
											{u.name || "Unknown"} ({u.email})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Primary Client */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="primaryClient">Primary Client *</Label>
								<Select
									value={deployPrimaryClientId}
									onValueChange={(val) => {
										if (val) setDeployPrimaryClientId(val);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select primary client">
											{(() => {
												const c = companies.find(
													(comp) => comp.id === deployPrimaryClientId,
												);
												return c ? cleanCompanyName(c.name) : "Select client";
											})()}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{companies
											.filter((c) => !c.isInternal)
											.map((c) => (
												<SelectItem key={c.id} value={c.id}>
													{cleanCompanyName(c.name)} ({c.code})
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>

							{/* End Client (Optional) */}
							<div className="space-y-1.5">
								<Label htmlFor="endClient">End Client (Optional)</Label>
								<Select
									value={deployEndClientId}
									onValueChange={(val) => {
										if (val) setDeployEndClientId(val);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Direct client engagement">
											{deployEndClientId === "none"
												? "Direct engagement (None)"
												: cleanCompanyName(
														companies.find((c) => c.id === deployEndClientId)
															?.name,
													)}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">
											Direct engagement (None)
										</SelectItem>
										{companies
											.filter(
												(c) => !c.isInternal && c.id !== deployPrimaryClientId,
											)
											.map((c) => (
												<SelectItem key={c.id} value={c.id}>
													{cleanCompanyName(c.name)} ({c.code})
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Role & Dates */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="roleTitle">Project Role / Title</Label>
								<Input
									id="roleTitle"
									value={deployRoleTitle}
									onChange={(e) => setDeployRoleTitle(e.target.value)}
									placeholder="e.g. Senior Backend Engineer"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="deployStart">Start Date *</Label>
								<Input
									id="deployStart"
									type="date"
									value={deployStartDate}
									onChange={(e) => setDeployStartDate(e.target.value)}
									required
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="deployEnd">End Date (Optional)</Label>
								<Input
									id="deployEnd"
									type="date"
									value={deployEndDate}
									onChange={(e) => setDeployEndDate(e.target.value)}
								/>
							</div>
						</div>

						{/* Bundle Initial Gear */}
						{availableAssets.length > 0 && (
							<div className="space-y-2 pt-2 border-t border-border/50">
								<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Bundle Initial Devices & Accounts
								</Label>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
									{availableAssets.map((asset) => {
										const checked = selectedBundleAssetIds.includes(asset.id);
										return (
											<label
												key={asset.id}
												className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
													checked
														? "border-primary/50 bg-primary/5"
														: "border-border/60 hover:bg-muted/40"
												}`}
											>
												<input
													type="checkbox"
													checked={checked}
													onChange={() => toggleBundleAsset(asset.id)}
													className="rounded border-border size-3.5 text-primary"
												/>
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-1">
														<span className="font-mono font-bold text-foreground">
															{asset.assetTag}
														</span>
														<span className="text-[10px] text-muted-foreground">
															({asset.category})
														</span>
													</div>
													<div className="text-muted-foreground truncate">
														{asset.name}
													</div>
												</div>
											</label>
										);
									})}
								</div>
							</div>
						)}

						{/* Notes */}
						<div className="space-y-1.5">
							<Label htmlFor="deployNotes">Notes (Optional)</Label>
							<Textarea
								id="deployNotes"
								value={deployNotes}
								onChange={(e) => setDeployNotes(e.target.value)}
								rows={2}
								placeholder="e.g. Cummins SOW #402 onboarding"
							/>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setDeployDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Deploying..." : "Confirm Deployment"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Modal: Edit Engagement */}
			<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
				<DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Client Engagement</DialogTitle>
						<DialogDescription>
							Update project role, timeline, or client relationship for{" "}
							<strong>{editingDeployment?.userName}</strong>.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleUpdateDeploy} className="space-y-4 py-1">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="editPrimaryClient">Primary Client *</Label>
								<Select
									value={editPrimaryClientId}
									onValueChange={(val) => {
										if (val) setEditPrimaryClientId(val);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Primary Client">
											{(() => {
												const c = companies.find(
													(comp) => comp.id === editPrimaryClientId,
												);
												return c ? cleanCompanyName(c.name) : "Select client";
											})()}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{companies
											.filter((c) => !c.isInternal)
											.map((c) => (
												<SelectItem key={c.id} value={c.id}>
													{cleanCompanyName(c.name)} ({c.code})
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="editEndClient">End Client</Label>
								<Select
									value={editEndClientId}
									onValueChange={(val) => {
										if (val) setEditEndClientId(val);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Direct Client (None)">
											{editEndClientId === "none"
												? "Direct engagement (None)"
												: cleanCompanyName(
														companies.find((c) => c.id === editEndClientId)
															?.name,
													)}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">
											Direct engagement (None)
										</SelectItem>
										{companies
											.filter(
												(c) => !c.isInternal && c.id !== editPrimaryClientId,
											)
											.map((c) => (
												<SelectItem key={c.id} value={c.id}>
													{cleanCompanyName(c.name)} ({c.code})
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="editRole">Project Role / Title</Label>
								<Input
									id="editRole"
									value={editRoleTitle}
									onChange={(e) => setEditRoleTitle(e.target.value)}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="editStatus">Status</Label>
								<Select
									value={editStatus}
									onValueChange={(val) => {
										if (val)
											setEditStatus(
												val as "active" | "completed" | "terminated",
											);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Status">
											{editStatus === "active"
												? "Active Engagement"
												: "Completed"}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="active">Active Engagement</SelectItem>
										<SelectItem value="completed">Completed</SelectItem>
										<SelectItem value="terminated">Terminated</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="editStart">Start Date *</Label>
								<Input
									id="editStart"
									type="date"
									value={editStartDate}
									onChange={(e) => setEditStartDate(e.target.value)}
									required
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="editEnd">End Date</Label>
								<Input
									id="editEnd"
									type="date"
									value={editEndDate}
									onChange={(e) => setEditEndDate(e.target.value)}
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="editNotes">Notes</Label>
							<Textarea
								id="editNotes"
								value={editNotes}
								onChange={(e) => setEditNotes(e.target.value)}
								rows={2}
							/>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setEditDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Saving..." : "Save Changes"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Modal: Offboard Clearance */}
			<Dialog open={offboardDialogOpen} onOpenChange={setOffboardDialogOpen}>
				<DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="text-destructive flex items-center gap-2">
							<LogOut className="size-5 text-muted-foreground" /> Offboard from
							Client Engagement
						</DialogTitle>
						<DialogDescription>
							Complete clearance for{" "}
							<strong>{deploymentToOffboard?.userName}</strong> offboarding from{" "}
							<strong>
								{cleanCompanyName(deploymentToOffboard?.primaryCompanyName)}
							</strong>
							. Check all items that are returned to inventory.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleConfirmOffboard} className="space-y-4 py-1">
						<div className="space-y-1.5">
							<Label htmlFor="offboardDate">Clearance Date *</Label>
							<Input
								id="offboardDate"
								type="date"
								value={offboardDate}
								onChange={(e) => setOffboardDate(e.target.value)}
								required
							/>
						</div>

						{/* Equipment checklist */}
						{deploymentToOffboard &&
							deploymentToOffboard.assignedAssets.length > 0 && (
								<div className="space-y-2 pt-2 border-t border-border/50">
									<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Return Equipment to Brainee.org Inventory
									</Label>
									<div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
										{deploymentToOffboard.assignedAssets.map((asset) => {
											const checked = Boolean(
												assetsToReturnSelection[asset.assetId],
											);
											return (
												<label
													key={asset.assetId}
													className="flex items-center gap-2 p-2 rounded-md border border-border/60 text-xs cursor-pointer hover:bg-muted/40"
												>
													<input
														type="checkbox"
														checked={checked}
														onChange={(e) =>
															setAssetsToReturnSelection({
																...assetsToReturnSelection,
																[asset.assetId]: e.target.checked,
															})
														}
														className="rounded border-border size-3.5 text-primary"
													/>
													<div className="min-w-0 flex-1 flex items-center justify-between gap-1">
														<div>
															<span className="font-mono font-bold text-foreground">
																{asset.assetTag}
															</span>{" "}
															- {asset.assetName}
														</div>
														<Badge
															variant="outline"
															className="text-[10px] font-mono"
														>
															{asset.ownerCompanyName || "Brainee.org"}
														</Badge>
													</div>
												</label>
											);
										})}
									</div>
								</div>
							)}

						<div className="space-y-1.5">
							<Label htmlFor="offboardReason">Clearance Notes</Label>
							<Textarea
								id="offboardReason"
								value={offboardReason}
								onChange={(e) => setOffboardReason(e.target.value)}
								rows={2}
								placeholder="e.g. Project successfully delivered, client sign-off received"
							/>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setOffboardDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" variant="destructive" disabled={isPending}>
								{isPending ? "Processing..." : "Complete Offboarding"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Assign Gear Dialog */}
			<AssetAssignDialog
				open={assignDialogOpen}
				onOpenChange={setAssignDialogOpen}
				asset={assetToAssign}
				users={users}
				deployments={deployments}
				today={today}
				initialUserId={selectedUserIdForAssign}
				onSuccess={onRefresh}
			/>

			{/* Return Asset Dialog */}
			<AssetReturnDialog
				open={returnDialogOpen}
				onOpenChange={setReturnDialogOpen}
				asset={assetToReturn}
				today={today}
				onSuccess={onRefresh}
			/>

			{/* History Drawer */}
			<AssetHistoryDrawer
				assetId={selectedHistoryAssetId}
				open={historyOpen}
				onOpenChange={setHistoryOpen}
			/>
		</div>
	);
}
