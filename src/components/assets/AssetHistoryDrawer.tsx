import {
	AlertTriangle,
	ArrowDownToLine,
	ArrowLeftRight,
	ArrowUpRight,
	Ban,
	CheckCircle2,
	CircleDot,
	Clock,
	Copy,
	Laptop,
	Package,
	RefreshCw,
	User,
	Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAssetHistory } from "@/api/assets";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { formatDateDisplay } from "@/lib/date-format";
import { AssetCategoryBadge } from "./AssetCategoryBadge";
import { AssetStatusBadge } from "./AssetStatusBadge";

interface AssetHistoryDrawerProps {
	assetId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type AssetHistoryData = NonNullable<
	Awaited<ReturnType<typeof getAssetHistory>>
>;

export function AssetHistoryDrawer({
	assetId,
	open,
	onOpenChange,
}: AssetHistoryDrawerProps) {
	const [data, setData] = useState<AssetHistoryData | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (assetId && open) {
			setIsLoading(true);
			getAssetHistory({ data: assetId })
				.then((res) => {
					setData(res);
				})
				.catch(() => {
					toast.error("Failed to load asset history");
				})
				.finally(() => {
					setIsLoading(false);
				});
		} else {
			setData(null);
		}
	}, [assetId, open]);

	const copySerial = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success("Copied to clipboard");
	};

	const getEventIcon = (eventType: string) => {
		switch (eventType) {
			case "created":
				return <Package className="size-4 text-success" />;
			case "assigned":
				return <ArrowUpRight className="size-4 text-info" />;
			case "receipt_acknowledged":
				return <CheckCircle2 className="size-4 text-success" />;
			case "issue_reported":
				return <AlertTriangle className="size-4 text-warning" />;
			case "issue_resolved":
				return <CheckCircle2 className="size-4 text-info" />;
			case "returned":
				return <ArrowDownToLine className="size-4 text-info" />;
			case "reassigned":
				return <ArrowLeftRight className="size-4 text-asset-capital" />;
			case "marked_defective":
				return <AlertTriangle className="size-4 text-destructive" />;
			case "maintenance_start":
			case "maintenance_end":
				return <Wrench className="size-4 text-warning" />;
			case "replaced":
				return (
					<ArrowLeftRight className="size-4 text-status-holiday-foreground" />
				);
			case "disposed":
				return <Ban className="size-4 text-muted-foreground" />;
			case "renewed":
				return <RefreshCw className="size-4 text-asset-digital" />;
			default:
				return <CircleDot className="size-4 text-muted-foreground" />;
		}
	};

	const getEventLabel = (eventType: string) => {
		switch (eventType) {
			case "created":
				return "Ingested into Inventory";
			case "assigned":
				return "Assigned to Employee";
			case "receipt_acknowledged":
				return "Receipt Confirmed by Employee";
			case "issue_reported":
				return "Issue Reported by Employee";
			case "issue_resolved":
				return "Issue Resolved by IT / Admin";
			case "returned":
				return "Returned & Checked in";
			case "reassigned":
				return "Reassigned / Transferred";
			case "marked_defective":
				return "Flagged as Defective";
			case "maintenance_start":
				return "Sent to Maintenance";
			case "maintenance_end":
				return "Returned from Maintenance";
			case "replaced":
				return "Replaced by New Unit";
			case "disposed":
				return "Decommissioned / Disposed";
			case "renewed":
				return "Subscription / License Renewed";
			case "details_updated":
				return "Specs / Details Updated";
			default:
				return eventType;
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="sm:max-w-md md:max-w-lg">
				<SheetHeader>
					<div className="flex items-center gap-2 mb-1 flex-wrap">
						<span className="font-mono text-sm font-semibold tracking-wider text-muted-foreground">
							{data?.asset?.assetTag || "ASSET DETAILS"}
						</span>
						{data?.asset && (
							<>
								<AssetCategoryBadge category={data.asset.category} />
								<AssetStatusBadge status={data.asset.status} />
							</>
						)}
					</div>
					<SheetTitle className="text-lg font-semibold">
						{data?.asset?.name || "Loading..."}
					</SheetTitle>
					<SheetDescription>
						Complete lifecycle, warranty records, and assignment history.
					</SheetDescription>
				</SheetHeader>

				<SheetBody className="space-y-6">
					{isLoading ? (
						<div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
							Loading lifecycle audit trail...
						</div>
					) : !data?.asset ? (
						<div className="text-center py-12 text-muted-foreground text-sm">
							Asset details not available.
						</div>
					) : (
						<>
							{/* Key Specs Card */}
							<div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3">
								<div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
									<Laptop className="size-3.5" /> Hardware & Ownership Specs
								</div>

								<div className="grid grid-cols-2 gap-3 text-xs">
									<div>
										<span className="text-muted-foreground block">
											Owner Company
										</span>
										<span className="font-medium text-foreground">
											{data.asset.ownerCompanyName || "Brainee.org"}
										</span>
									</div>

									<div>
										<span className="text-muted-foreground block">
											{data.asset.assetType === "digital_account"
												? "Username / ID"
												: "Serial Number"}
										</span>
										{data.asset.serialNumber ? (
											<div className="flex items-center gap-1 font-mono font-medium">
												<span className="truncate">
													{data.asset.serialNumber}
												</span>
												<Button
													type="button"
													variant="ghost"
													size="icon-xs"
													onClick={() =>
														copySerial(data.asset.serialNumber ?? "")
													}
													className="text-muted-foreground hover:text-foreground"
												>
													<Copy className="size-3" />
												</Button>
											</div>
										) : (
											<span className="text-muted-foreground">-</span>
										)}
									</div>

									{data.asset.model && (
										<div>
											<span className="text-muted-foreground block">
												Model / Brand
											</span>
											<span className="font-medium">{data.asset.model}</span>
										</div>
									)}

									{data.asset.purchaseDate && (
										<div>
											<span className="text-muted-foreground block">
												Purchased
											</span>
											<span className="font-medium">
												{formatDateDisplay(new Date(data.asset.purchaseDate))}
											</span>
										</div>
									)}

									{data.asset.purchaseCost && (
										<div>
											<span className="text-muted-foreground block">Cost</span>
											<span className="font-medium">
												${data.asset.purchaseCost.toLocaleString()}
											</span>
										</div>
									)}

									{data.asset.warrantyExpiry && (
										<div>
											<span className="text-muted-foreground block">
												Warranty Expiry
											</span>
											<span className="font-medium">
												{formatDateDisplay(new Date(data.asset.warrantyExpiry))}
											</span>
										</div>
									)}

									{data.asset.renewalDate && (
										<div>
											<span className="text-muted-foreground block">
												Renewal Date
											</span>
											<span className="font-medium text-warning">
												{formatDateDisplay(new Date(data.asset.renewalDate))}
											</span>
										</div>
									)}
								</div>

								{data.asset.specs && (
									<div className="pt-2 border-t border-border/50 text-xs">
										<span className="text-muted-foreground block mb-0.5">
											Configuration
										</span>
										<p className="font-mono text-foreground/90 bg-muted/30 p-2 rounded-md">
											{data.asset.specs}
										</p>
									</div>
								)}

								{data.asset.defectReason && (
									<div className="pt-2 border-t border-destructive/20 text-xs bg-destructive/5 p-2 rounded-md text-destructive">
										<span className="font-semibold block">Defect Note:</span>
										<p>{data.asset.defectReason}</p>
									</div>
								)}

								{data.asset.disposalReason && (
									<div className="pt-2 border-t border-border text-xs bg-muted/50 p-2 rounded-md text-muted-foreground">
										<span className="font-semibold block">
											Disposed on {data.asset.disposalDate}:
										</span>
										<p>{data.asset.disposalReason}</p>
									</div>
								)}
							</div>

							{/* Timeline Header */}
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="text-sm font-semibold font-heading tracking-tight flex items-center gap-1.5">
										<Clock className="size-4 text-muted-foreground" /> Lifecycle
										Audit History
									</h3>
									<span className="text-xs text-muted-foreground">
										{data.history.length} event
										{data.history.length === 1 ? "" : "s"}
									</span>
								</div>

								{/* Timeline Items */}
								{data.history.length === 0 ? (
									<div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
										No history recorded for this item yet.
									</div>
								) : (
									<div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
										{data.history.map((event) => (
											<div key={event.id} className="relative group">
												{/* Dot */}
												<div className="absolute -left-6 top-0.5 flex size-5 items-center justify-center rounded-full bg-background border border-border">
													{getEventIcon(event.eventType)}
												</div>

												{/* Event Content */}
												<div className="space-y-1">
													<div className="flex items-center justify-between gap-2">
														<span className="text-xs font-semibold text-foreground">
															{getEventLabel(event.eventType)}
														</span>
														{event.createdAt && (
															<span className="text-[10px] font-mono text-muted-foreground">
																{formatDateDisplay(new Date(event.createdAt))}
															</span>
														)}
													</div>

													{event.targetUserName && (
														<p className="text-xs text-foreground/80 flex items-center gap-1">
															<User className="size-3 text-muted-foreground" />
															Target:{" "}
															<span className="font-medium text-foreground">
																{event.targetUserName}
															</span>
														</p>
													)}

													{event.actor && (
														<p className="text-[11px] text-muted-foreground">
															By: {event.actor.name}
														</p>
													)}

													{/* Details badge/notes */}
													{event.details &&
														Object.keys(event.details).length > 0 && (
															<div className="mt-1 rounded-md bg-muted/40 p-2 text-xs space-y-1 text-muted-foreground">
																{event.details.conditionOut && (
																	<div>
																		Checkout Condition:{" "}
																		<span className="font-medium text-foreground capitalize">
																			{String(event.details.conditionOut)}
																		</span>
																	</div>
																)}
																{event.details.conditionIn && (
																	<div>
																		Return Condition:{" "}
																		<span className="font-medium text-foreground capitalize">
																			{String(event.details.conditionIn)}
																		</span>
																	</div>
																)}
																{event.details.returnDestination && (
																	<div>
																		Routed To:{" "}
																		<span className="font-medium text-foreground">
																			{event.details.returnDestination ===
																			"brainee_inventory"
																				? "Brainee.org Available Inventory"
																				: "Surrendered to Client"}
																		</span>
																	</div>
																)}
																{event.details.reason && (
																	<div>
																		Reason:{" "}
																		<span className="text-foreground">
																			{String(event.details.reason)}
																		</span>
																	</div>
																)}
																{event.details.notes && (
																	<p className="italic text-foreground/80">
																		&ldquo;{String(event.details.notes)}&rdquo;
																	</p>
																)}
															</div>
														)}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</>
					)}
				</SheetBody>
			</SheetContent>
		</Sheet>
	);
}
