import {
	AlertTriangle,
	ArrowDownToLine,
	Building2,
	CheckCircle2,
	ChevronRight,
	Laptop,
	Package,
	Plus,
	Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	acknowledgeAssetReceipt,
	reportAssetIssue,
	resolveAssetIssue,
} from "@/api/assets";
import { getEmployeeEquipmentAndDeployments } from "@/api/deployments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateDisplay } from "@/lib/date-format";
import { type AssetCategory, AssetCategoryBadge } from "./AssetCategoryBadge";

export interface EmployeeEquipmentItem {
	assignmentId: string;
	assetId: string;
	assetTag: string;
	name: string;
	category: string;
	assetType: string;
	ownerCompanyId?: string;
	ownerCompanyName: string | null;
	ownerCompanyCode: string | null;
	ownerCompanyIsInternal: boolean | null;
	serialNumber: string | null;
	model: string | null;
	specs: string | null;
	assignedDate: string;
	conditionOut: string;
	accountExpiry: string | null;
	renewalDate: string | null;
	acknowledgedAt?: Date | string | null;
	issueReportedAt?: Date | string | null;
	issueDescription?: string | null;
	issueStatus?: string | null;
}

export interface EmployeeDeploymentItem {
	id: string;
	primaryClientId: string;
	primaryCompanyName: string | null;
	primaryCompanyCode: string | null;
	primaryCompanyIsInternal?: boolean;
	endClientId: string | null;
	endCompanyName: string | null;
	endCompanyCode: string | null;
	endCompanyIsInternal?: boolean;
	roleTitle: string | null;
	startDate: string;
	endDate: string | null;
	status: string;
}

interface EmployeeEquipmentSectionProps {
	userId: string;
	isAdmin?: boolean;
	onAssignClick?: () => void;
	onReturnClick?: (asset: EmployeeEquipmentItem) => void;
	hideDeployments?: boolean;
	onDeploymentsLoaded?: (deployments: EmployeeDeploymentItem[]) => void;
}

export function EmployeeEquipmentSection({
	userId,
	isAdmin = false,
	onAssignClick,
	onReturnClick,
	hideDeployments = false,
	onDeploymentsLoaded,
}: EmployeeEquipmentSectionProps) {
	const [data, setData] = useState<{
		assets: EmployeeEquipmentItem[];
		deployments: EmployeeDeploymentItem[];
	} | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();

	// Report Issue Modal
	const [reportDialogOpen, setReportDialogOpen] = useState(false);
	const [selectedAssetForIssue, setSelectedAssetForIssue] =
		useState<EmployeeEquipmentItem | null>(null);
	const [issueText, setIssueText] = useState("");

	const loadData = useCallback(() => {
		setIsLoading(true);
		getEmployeeEquipmentAndDeployments({ data: { userId } })
			.then((res) => {
				if (res && !("error" in res)) {
					const typedRes = res as unknown as {
						assets: EmployeeEquipmentItem[];
						deployments: EmployeeDeploymentItem[];
					};
					setData(typedRes);
					if (onDeploymentsLoaded) {
						onDeploymentsLoaded(typedRes.deployments || []);
					}
				}
			})
			.catch(() => {
				toast.error("Failed to load employee equipment");
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, [userId, onDeploymentsLoaded]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleAcknowledge = (assignmentId: string) => {
		startTransition(async () => {
			try {
				const res = await acknowledgeAssetReceipt({
					data: { assignmentId },
				});
				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Receipt acknowledged successfully!");
					loadData();
				}
			} catch (_err) {
				toast.error("Failed to acknowledge receipt");
			}
		});
	};

	const handleOpenReportIssue = (asset: EmployeeEquipmentItem) => {
		setSelectedAssetForIssue(asset);
		setIssueText("");
		setReportDialogOpen(true);
	};

	const handleSubmitIssue = (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedAssetForIssue || !issueText.trim()) return;

		startTransition(async () => {
			try {
				const res = await reportAssetIssue({
					data: {
						assignmentId: selectedAssetForIssue.assignmentId,
						description: issueText.trim(),
					},
				});
				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Issue submitted to IT / Admin");
					setReportDialogOpen(false);
					loadData();
				}
			} catch (_err) {
				toast.error("Failed to report issue");
			}
		});
	};

	const handleResolveIssue = (assignmentId: string) => {
		startTransition(async () => {
			try {
				const res = await resolveAssetIssue({
					data: { assignmentId },
				});
				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Issue marked as resolved");
					loadData();
				}
			} catch (_err) {
				toast.error("Failed to resolve issue");
			}
		});
	};

	const cleanCompanyName = (name?: string | null) => {
		if (!name) return "";
		return name.replace(/\s*\([^)]*\)$/, "").trim();
	};

	if (isLoading) {
		return (
			<Card className="border-border/60 bg-card">
				<CardContent className="py-8 text-center text-xs text-muted-foreground">
					Loading assigned equipment and deployments...
				</CardContent>
			</Card>
		);
	}

	const allAssets = data?.assets || [];
	const deployments = data?.deployments || [];

	return (
		<div className="space-y-4">
			{/* Client Deployments (Only rendered when not hidden by parent) */}
			{!hideDeployments && deployments.length > 0 && (
				<Card className="border-border/60 bg-card">
					<CardHeader className="p-5 pb-4 border-b border-border/40 flex flex-row items-center justify-between">
						<div>
							<CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
								<Building2 className="size-4 text-muted-foreground" /> Active
								Client Deployments
							</CardTitle>
							<CardDescription className="text-xs text-muted-foreground mt-0.5">
								Projects and client companies this employee is deployed to
							</CardDescription>
						</div>
						<Badge
							variant="outline"
							className="text-[10px] font-mono border-success/30 text-success bg-success/10"
						>
							<span className="size-1.5 rounded-full bg-success mr-1 shrink-0" />
							Active
						</Badge>
					</CardHeader>
					<CardContent className="p-5">
						<div className="divide-y divide-border/40">
							{deployments.map((dep) => {
								const isInternalPrimary =
									dep.primaryCompanyIsInternal ||
									dep.primaryCompanyCode === "Brainee.org" ||
									dep.primaryCompanyName
										?.toLowerCase()
										.includes("brainee.org");

								return (
									<div
										key={dep.id}
										className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-2 flex-wrap text-xs"
									>
										<div className="space-y-0.5">
											<div className="flex items-center gap-1.5 font-medium text-foreground">
												<span>Brainee.org</span>
												{!isInternalPrimary && (
													<>
														<ChevronRight className="size-3 text-muted-foreground/60" />
														<span className="text-primary font-semibold">
															{cleanCompanyName(dep.primaryCompanyName)}
														</span>
													</>
												)}
												{dep.endCompanyName && (
													<>
														<ChevronRight className="size-3 text-muted-foreground/60" />
														<span className="text-info font-semibold">
															{cleanCompanyName(dep.endCompanyName)}
														</span>
													</>
												)}
											</div>
											<p className="text-[11px] text-muted-foreground">
												{dep.roleTitle || "General Deployment"}
											</p>
										</div>

										<span className="text-[11px] text-muted-foreground">
											Since {formatDateDisplay(new Date(dep.startDate))}
										</span>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Equipment & Accounts Card */}
			<Card className="border-border/60 bg-card">
				<CardHeader className="p-5 pb-4 border-b border-border/40 flex flex-row items-center justify-between gap-3">
					<div>
						<CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
							<Laptop className="size-4 text-muted-foreground" /> Assigned
							Equipment & Accounts
						</CardTitle>
						<CardDescription className="text-xs text-muted-foreground mt-0.5">
							Hardware custody, peripherals, and credentials
						</CardDescription>
					</div>

					<div className="flex items-center gap-2">
						<Badge
							variant="secondary"
							className="font-mono text-xs px-2 py-0.5"
						>
							{allAssets.length} {allAssets.length === 1 ? "Item" : "Items"}
						</Badge>

						{isAdmin && onAssignClick && (
							<Button
								size="sm"
								variant="outline"
								onClick={onAssignClick}
								className="gap-1 text-xs h-7"
							>
								<Plus className="size-3.5" /> Assign
							</Button>
						)}
					</div>
				</CardHeader>

				<CardContent className="p-5">
					{allAssets.length === 0 ? (
						<div className="py-8 text-center text-xs text-muted-foreground space-y-1.5">
							<Package className="size-8 mx-auto text-muted-foreground/40" />
							<p>No equipment or accounts currently assigned.</p>
						</div>
					) : (
						<div className="divide-y divide-border/40">
							{allAssets.map((asset) => {
								const hasIssue =
									asset.issueStatus === "open" ||
									asset.issueStatus === "investigating";
								const isDigital =
									asset.assetType === "digital_account" ||
									asset.category === "digital_account";

								return (
									<div
										key={asset.assignmentId}
										className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
									>
										<div className="space-y-1 min-w-0">
											<div className="flex items-center gap-1.5 flex-wrap">
												<span className="font-mono font-bold text-foreground text-xs">
													{asset.assetTag}
												</span>
												<AssetCategoryBadge
													category={asset.category as AssetCategory}
												/>
												<Badge
													variant={
														asset.ownerCompanyIsInternal
															? "default"
															: "secondary"
													}
													className="text-[10px] font-mono h-4 px-1"
												>
													{asset.ownerCompanyCode || "Brainee.org"}
												</Badge>
											</div>

											<div>
												<span className="font-semibold text-foreground text-xs">
													{asset.name}
												</span>
												{(asset.model || asset.specs) && (
													<span className="text-muted-foreground text-[11px] ml-1.5 truncate">
														· {asset.model ? `${asset.model} · ` : ""}
														{asset.specs || ""}
													</span>
												)}
											</div>

											<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
												<span>
													Assigned:{" "}
													{formatDateDisplay(new Date(asset.assignedDate))}
												</span>
												{isDigital ? (
													asset.renewalDate && (
														<>
															<span>·</span>
															<span className="text-warning font-medium">
																Renews:{" "}
																{formatDateDisplay(new Date(asset.renewalDate))}
															</span>
														</>
													)
												) : asset.serialNumber ? (
													<>
														<span>·</span>
														<span className="font-mono">
															SN: {asset.serialNumber}
														</span>
													</>
												) : null}
											</div>

											{hasIssue && (
												<div className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning/10 border border-warning/30 px-1.5 py-0.5 rounded font-medium mt-0.5">
													<AlertTriangle className="size-2.5 shrink-0" />
													<span>Issue: {asset.issueDescription}</span>
													{isAdmin && (
														<button
															type="button"
															className="underline ml-1 cursor-pointer font-semibold"
															onClick={() =>
																handleResolveIssue(asset.assignmentId)
															}
														>
															Mark Resolved
														</button>
													)}
												</div>
											)}
										</div>

										<div className="flex items-center gap-1.5 shrink-0">
											{asset.acknowledgedAt ? (
												<span className="text-success text-xs flex items-center gap-1 font-medium bg-success/10 border border-success/20 px-2 py-1 rounded">
													<CheckCircle2 className="size-3.5 shrink-0" />{" "}
													Confirmed
												</span>
											) : (
												<Button
													size="sm"
													className="h-7 text-xs bg-success hover:bg-success/90 text-success-foreground gap-1 font-medium cursor-pointer"
													onClick={() => handleAcknowledge(asset.assignmentId)}
													disabled={isPending}
												>
													<CheckCircle2 className="size-3" /> Acknowledge
													Receipt
												</Button>
											)}

											{!hasIssue && !isDigital && (
												<Button
													variant="ghost"
													size="sm"
													className="h-7 px-2 text-xs text-muted-foreground hover:text-warning gap-1 cursor-pointer"
													onClick={() => handleOpenReportIssue(asset)}
												>
													<Wrench className="size-3" /> Report Issue
												</Button>
											)}

											{isAdmin && onReturnClick && (
												<Button
													variant="ghost"
													size="sm"
													className="h-7 px-2 text-xs text-info gap-1 hover:bg-info/10 cursor-pointer"
													onClick={() => onReturnClick(asset)}
												>
													<ArrowDownToLine className="size-3" /> Return
												</Button>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Modal: Report Issue Dialog */}
			<Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-sm font-semibold">
							<AlertTriangle className="size-4 text-muted-foreground" /> Report
							Hardware Issue
						</DialogTitle>
						<DialogDescription className="text-xs">
							Describe the defect or problem with{" "}
							<strong>{selectedAssetForIssue?.name}</strong> (
							{selectedAssetForIssue?.assetTag}).
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleSubmitIssue} className="space-y-3 py-1">
						<div className="space-y-1">
							<Label htmlFor="issueDesc" className="text-xs">
								Description of Issue *
							</Label>
							<Textarea
								id="issueDesc"
								rows={3}
								value={issueText}
								onChange={(e) => setIssueText(e.target.value)}
								placeholder="e.g. Battery draining fast, screen flicker on HDMI, keys sticking..."
								required
								className="text-xs"
							/>
						</div>

						<DialogFooter className="gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setReportDialogOpen(false)}
								className="text-xs h-8"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								size="sm"
								disabled={isPending || !issueText.trim()}
								className="text-xs h-8"
							>
								{isPending ? "Submitting..." : "Submit to IT"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
