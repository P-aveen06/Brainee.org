import {
	AlertCircle,
	ArrowDownToLine,
	Building2,
	PackageCheck,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { returnAsset } from "@/api/assets";
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
import { Textarea } from "@/components/ui/textarea";

interface AssetToReturn {
	id: string;
	assetTag: string;
	name: string;
	ownerCompanyName?: string | null;
	ownerCompanyIsInternal?: boolean | null;
	currentAssignment?: {
		userName: string | null;
		assignedDate: string;
	} | null;
}

interface AssetReturnDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	asset: AssetToReturn | null;
	today: string;
	onSuccess: () => void;
}

export function AssetReturnDialog({
	open,
	onOpenChange,
	asset,
	today,
	onSuccess,
}: AssetReturnDialogProps) {
	const [isPending, startTransition] = useTransition();

	const [conditionIn, setConditionIn] = useState<
		"good" | "fair" | "damaged" | "defective"
	>("good");
	const [returnedDate, setReturnedDate] = useState(today);
	const [returnNotes, setReturnNotes] = useState("");

	useEffect(() => {
		setReturnedDate(today);
		setConditionIn("good");
		setReturnNotes("");
	}, [today]);

	const isInternal = asset?.ownerCompanyIsInternal ?? true;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!asset) return;

		startTransition(async () => {
			try {
				const res = await returnAsset({
					data: {
						assetId: asset.id,
						conditionIn,
						returnNotes: returnNotes.trim() || null,
						returnedDate,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else if ("returnDestination" in res) {
					if (res.returnDestination === "brainee_inventory") {
						toast.success(
							`Item returned to Brainee.org Inventory (${res.newStatus === "defective" ? "Marked Defective" : "Available"})`,
						);
					} else {
						toast.success(
							`Item marked as Returned / Surrendered to ${asset.ownerCompanyName || "Client"}`,
						);
					}
					onOpenChange(false);
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to process return");
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ArrowDownToLine className="size-5 text-muted-foreground" /> Return
						& Check-in Item
					</DialogTitle>
					<DialogDescription>
						Record return inspection for <strong>{asset?.assetTag}</strong> (
						{asset?.name}) currently assigned to{" "}
						<strong>{asset?.currentAssignment?.userName || "employee"}</strong>.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4.5 py-1">
					{/* Smart Return Routing Banner */}
					<div
						className={`rounded-lg border p-3 text-xs flex items-start gap-2.5 ${
							isInternal
								? "bg-success/10 border-success/20 text-success"
								: "bg-info/10 border-info/20 text-info"
						}`}
					>
						{isInternal ? (
							<PackageCheck className="size-4 shrink-0 mt-0.5" />
						) : (
							<Building2 className="size-4 shrink-0 mt-0.5" />
						)}
						<div>
							<div className="font-semibold mb-0.5">
								{isInternal ? "Brainee.org Owned Equipment" : "Client Owned Property"}
							</div>
							<p className="opacity-90">
								{isInternal
									? "Upon check-in, this item will automatically return to Brainee.org Inventory as Available for the next hire."
									: `This asset belongs to ${asset?.ownerCompanyName || "External Client"}. It will be marked as Surrendered / Returned to client.`}
							</p>
						</div>
					</div>

					{/* Return Date & Condition */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="returnedDate">Return Date</Label>
							<Input
								id="returnedDate"
								type="date"
								value={returnedDate}
								onChange={(e) => setReturnedDate(e.target.value)}
								required
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="conditionIn">Inspected Condition</Label>
							<Select
								value={conditionIn}
								onValueChange={(val) => {
									if (
										val === "good" ||
										val === "fair" ||
										val === "damaged" ||
										val === "defective"
									) {
										setConditionIn(val);
									}
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select condition">
										{(() => {
											if (conditionIn === "good") {
												return (
													<div className="flex items-center gap-2">
														<span className="size-2 rounded-full bg-success shrink-0" />
														<span>Good / Working</span>
													</div>
												);
											}
											if (conditionIn === "fair") {
												return (
													<div className="flex items-center gap-2">
														<span className="size-2 rounded-full bg-warning shrink-0" />
														<span>Fair / Minor Wear</span>
													</div>
												);
											}
											if (conditionIn === "damaged") {
												return (
													<div className="flex items-center gap-2">
														<span className="size-2 rounded-full bg-warning/80 shrink-0" />
														<span>Damaged (Needs Repair)</span>
													</div>
												);
											}
											if (conditionIn === "defective") {
												return (
													<div className="flex items-center gap-2">
														<span className="size-2 rounded-full bg-destructive shrink-0" />
														<span>Defective / Broken</span>
													</div>
												);
											}
											return conditionIn;
										})()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="good">
										<div className="flex items-center gap-2">
											<span className="size-2 rounded-full bg-success shrink-0" />
											<span>Good / Working</span>
										</div>
									</SelectItem>
									<SelectItem value="fair">
										<div className="flex items-center gap-2">
											<span className="size-2 rounded-full bg-warning shrink-0" />
											<span>Fair / Minor Wear</span>
										</div>
									</SelectItem>
									<SelectItem value="damaged">
										<div className="flex items-center gap-2">
											<span className="size-2 rounded-full bg-warning/80 shrink-0" />
											<span>Damaged (Needs Repair)</span>
										</div>
									</SelectItem>
									<SelectItem value="defective">
										<div className="flex items-center gap-2">
											<span className="size-2 rounded-full bg-destructive shrink-0" />
											<span>Defective / Broken</span>
										</div>
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Condition Warning if Damaged/Defective */}
					{(conditionIn === "damaged" || conditionIn === "defective") && (
						<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
							<AlertCircle className="size-4 shrink-0 mt-0.5" />
							<span>
								Marking as damaged/defective will automatically flag this item
								for maintenance or replacement.
							</span>
						</div>
					)}

					{/* Return Notes */}
					<div className="space-y-1.5">
						<Label htmlFor="returnNotes">Check-in Notes / Inspection</Label>
						<Textarea
							id="returnNotes"
							rows={2}
							value={returnNotes}
							onChange={(e) => setReturnNotes(e.target.value)}
							placeholder="Hardware condition, cleaned, accessories returned (charger, cable, case)..."
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
						<Button type="submit" disabled={isPending}>
							{isPending ? "Checking in..." : "Confirm Return"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
