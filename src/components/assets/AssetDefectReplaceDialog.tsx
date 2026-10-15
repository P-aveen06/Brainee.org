import { AlertTriangle, ArrowLeftRight, Ban, Wrench } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { markAssetStatus, replaceAsset } from "@/api/assets";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type DefectActionType =
	| "mark_defective"
	| "maintenance"
	| "resolve_maintenance"
	| "replace"
	| "dispose";

interface AvailableReplacementAsset {
	id: string;
	assetTag: string;
	name: string;
	category: string;
	status: string;
}

interface AssetDefectReplaceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	actionType: DefectActionType;
	asset: {
		id: string;
		assetTag: string;
		name: string;
		category: string;
		status: string;
	} | null;
	availableAssets: AvailableReplacementAsset[];
	onSuccess: () => void;
}

export function AssetDefectReplaceDialog({
	open,
	onOpenChange,
	actionType,
	asset,
	availableAssets,
	onSuccess,
}: AssetDefectReplaceDialogProps) {
	const [isPending, startTransition] = useTransition();

	const [reason, setReason] = useState("");
	const [replacementAssetId, setReplacementAssetId] = useState("");

	useEffect(() => {
		setReason("");
		// Filter available replacement assets with same category
		const matching = availableAssets.filter(
			(a) => a.id !== asset?.id && a.status === "in_inventory",
		);
		if (matching.length > 0) {
			setReplacementAssetId(matching[0].id);
		} else {
			setReplacementAssetId("");
		}
	}, [asset, availableAssets]);

	const getTitle = () => {
		switch (actionType) {
			case "mark_defective":
				return "Flag Asset as Defective";
			case "maintenance":
				return "Send to Maintenance / Repair";
			case "resolve_maintenance":
				return "Complete Maintenance (Return to Stock)";
			case "replace":
				return "Record Asset Replacement";
			case "dispose":
				return "Decommission & Dispose (Scrap)";
		}
	};

	const getDescription = () => {
		switch (actionType) {
			case "mark_defective":
				return `Record defect details for ${asset?.assetTag} (${asset?.name}).`;
			case "maintenance":
				return `Send ${asset?.assetTag} to vendor/internal repair.`;
			case "resolve_maintenance":
				return `Mark ${asset?.assetTag} as repaired and ready for assignment in inventory.`;
			case "replace":
				return `Link ${asset?.assetTag} to a replacement unit and retire the old asset.`;
			case "dispose":
				return `Permanently decommission ${asset?.assetTag} (thrown away, recycled, or scrapped).`;
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!asset) return;

		startTransition(async () => {
			try {
				if (actionType === "replace") {
					if (!replacementAssetId) {
						toast.error("Please select a replacement asset.");
						return;
					}
					const res = await replaceAsset({
						data: {
							defectiveAssetId: asset.id,
							replacementAssetId,
							notes: reason.trim() || null,
						},
					});
					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success("Asset replaced successfully");
						onOpenChange(false);
						onSuccess();
					}
				} else {
					let targetStatus:
						| "defective"
						| "maintenance"
						| "in_inventory"
						| "disposed" = "defective";
					if (actionType === "maintenance") targetStatus = "maintenance";
					if (actionType === "resolve_maintenance")
						targetStatus = "in_inventory";
					if (actionType === "dispose") targetStatus = "disposed";

					const res = await markAssetStatus({
						data: {
							assetId: asset.id,
							status: targetStatus,
							reason: reason.trim() || null,
						},
					});

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success(`Asset status updated to ${targetStatus}`);
						onOpenChange(false);
						onSuccess();
					}
				}
			} catch (_err) {
				toast.error("Failed to update asset");
			}
		});
	};

	// Filter replacement assets
	const eligibleReplacements = availableAssets.filter(
		(a) => a.id !== asset?.id && a.status === "in_inventory",
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{actionType === "mark_defective" && (
							<AlertTriangle className="size-5 text-muted-foreground" />
						)}
						{actionType === "maintenance" && (
							<Wrench className="size-5 text-muted-foreground" />
						)}
						{actionType === "resolve_maintenance" && (
							<Wrench className="size-5 text-muted-foreground" />
						)}
						{actionType === "replace" && (
							<ArrowLeftRight className="size-5 text-muted-foreground" />
						)}
						{actionType === "dispose" && (
							<Ban className="size-5 text-muted-foreground" />
						)}
						{getTitle()}
					</DialogTitle>
					<DialogDescription>{getDescription()}</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4.5 py-1">
					{actionType === "replace" && (
						<div className="space-y-1.5">
							<Label htmlFor="replacementSelect">
								Select Replacement Asset from Inventory *
							</Label>
							{eligibleReplacements.length === 0 ? (
								<div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground text-center">
									No available inventory items found. Add a replacement item to
									inventory first.
								</div>
							) : (
								<Select
									value={replacementAssetId}
									onValueChange={(val) => {
										if (val) setReplacementAssetId(val);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select replacement unit">
											{(() => {
												const found = eligibleReplacements.find(
													(a) => a.id === replacementAssetId,
												);
												return found
													? `${found.assetTag} - ${found.name}`
													: "Select replacement unit";
											})()}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{eligibleReplacements.map((a) => (
											<SelectItem key={a.id} value={a.id}>
												<div className="flex items-center gap-2">
													<span className="font-mono font-bold text-xs">
														{a.assetTag}
													</span>
													<span className="text-muted-foreground">-</span>
													<span>{a.name}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="reasonText">
							{actionType === "dispose"
								? "Disposal Reason / Scrapping Method *"
								: actionType === "mark_defective"
									? "Defect Symptom / Failure Details *"
									: "Notes / Details"}
						</Label>
						<Textarea
							id="reasonText"
							rows={3}
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder={
								actionType === "dispose"
									? "e.g. Broken screen, unrepairable motherboard, battery bloat..."
									: actionType === "mark_defective"
										? "e.g. Keyboard keys not responding, thermal overheating..."
										: "Service ticket number, vendor name, or technician notes..."
							}
							required={
								actionType === "dispose" || actionType === "mark_defective"
							}
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant={actionType === "dispose" ? "destructive" : "default"}
							disabled={
								isPending ||
								(actionType === "replace" && eligibleReplacements.length === 0)
							}
						>
							{isPending ? "Processing..." : "Confirm"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
