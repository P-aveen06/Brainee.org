import { Key, Laptop, Package } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createAsset, updateAsset } from "@/api/assets";
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
import { type AssetCategory, CATEGORY_OPTIONS } from "./AssetCategoryBadge";

interface CompanyOption {
	id: string;
	name: string;
	code: string;
	isInternal: boolean;
}

interface AssetToEdit {
	id?: string;
	assetTag?: string;
	name?: string;
	category?: string;
	assetType?: string;
	ownerCompanyId?: string;
	serialNumber?: string | null;
	model?: string | null;
	specs?: string | null;
	purchaseDate?: string | null;
	purchaseCost?: number | null;
	warrantyExpiry?: string | null;
	accountExpiry?: string | null;
	renewalDate?: string | null;
	notes?: string | null;
}

interface AssetFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	assetToEdit?: AssetToEdit | null;
	companies: CompanyOption[];
	onSuccess: () => void;
}

export function AssetFormDialog({
	open,
	onOpenChange,
	assetToEdit,
	companies,
	onSuccess,
}: AssetFormDialogProps) {
	const [isPending, startTransition] = useTransition();

	const isEditing = Boolean(assetToEdit?.id);

	// Form states
	const [assetType, setAssetType] = useState<
		"capital_asset" | "bulk_peripheral" | "digital_account"
	>(
		assetToEdit?.assetType === "digital_account"
			? "digital_account"
			: assetToEdit?.assetType === "bulk_peripheral"
				? "bulk_peripheral"
				: "capital_asset",
	);
	const [assetTag, setAssetTag] = useState(assetToEdit?.assetTag || "");
	const [name, setName] = useState(assetToEdit?.name || "");
	const [category, setCategory] = useState(assetToEdit?.category || "laptop");
	const [ownerCompanyId, setOwnerCompanyId] = useState(
		assetToEdit?.ownerCompanyId || companies[0]?.id || "",
	);
	const [serialNumber, setSerialNumber] = useState(
		assetToEdit?.serialNumber || "",
	);
	const [model, setModel] = useState(assetToEdit?.model || "");
	const [specs, setSpecs] = useState(assetToEdit?.specs || "");
	const [purchaseDate, setPurchaseDate] = useState(
		assetToEdit?.purchaseDate || "",
	);
	const [purchaseCost, setPurchaseCost] = useState(
		assetToEdit?.purchaseCost ? String(assetToEdit.purchaseCost) : "",
	);
	const [warrantyExpiry, setWarrantyExpiry] = useState(
		assetToEdit?.warrantyExpiry || "",
	);
	const [accountExpiry, setAccountExpiry] = useState(
		assetToEdit?.accountExpiry || "",
	);
	const [renewalDate, setRenewalDate] = useState(
		assetToEdit?.renewalDate || "",
	);
	const [quantity, setQuantity] = useState(1);
	const [notes, setNotes] = useState(assetToEdit?.notes || "");

	useEffect(() => {
		if (assetToEdit) {
			setAssetType(
				assetToEdit.assetType === "digital_account"
					? "digital_account"
					: assetToEdit.assetType === "bulk_peripheral"
						? "bulk_peripheral"
						: "capital_asset",
			);
			setAssetTag(assetToEdit.assetTag || "");
			setName(assetToEdit.name || "");
			setCategory(assetToEdit.category || "laptop");
			setOwnerCompanyId(assetToEdit.ownerCompanyId || companies[0]?.id || "");
			setSerialNumber(assetToEdit.serialNumber || "");
			setModel(assetToEdit.model || "");
			setSpecs(assetToEdit.specs || "");
			setPurchaseDate(assetToEdit.purchaseDate || "");
			setPurchaseCost(
				assetToEdit.purchaseCost ? String(assetToEdit.purchaseCost) : "",
			);
			setWarrantyExpiry(assetToEdit.warrantyExpiry || "");
			setAccountExpiry(assetToEdit.accountExpiry || "");
			setRenewalDate(assetToEdit.renewalDate || "");
			setQuantity(1);
			setNotes(assetToEdit.notes || "");
		} else {
			// Auto generate a tag prefix suggestion based on category
			setAssetType("capital_asset");
			setAssetTag(`TAG-${Math.floor(1000 + Math.random() * 9000)}`);
			setName("");
			setCategory("laptop");
			setOwnerCompanyId(companies[0]?.id || "");
			setSerialNumber("");
			setModel("");
			setSpecs("");
			setPurchaseDate("");
			setPurchaseCost("");
			setWarrantyExpiry("");
			setAccountExpiry("");
			setRenewalDate("");
			setQuantity(1);
			setNotes("");
		}
	}, [assetToEdit, companies]);

	// Auto switch assetType if digital_account category is picked
	const handleCategoryChange = (val: string) => {
		setCategory(val);
		if (val === "digital_account") {
			setAssetType("digital_account");
		} else if (val === "accessory") {
			setAssetType("bulk_peripheral");
		} else {
			setAssetType("capital_asset");
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!assetTag.trim() || !name.trim() || !ownerCompanyId) {
			toast.error("Please fill in all required fields.");
			return;
		}

		startTransition(async () => {
			try {
				const costNum = purchaseCost ? Number(purchaseCost) : null;

				if (isEditing && assetToEdit?.id) {
					const res = await updateAsset({
						data: {
							id: assetToEdit.id,
							assetTag: assetTag.trim(),
							name: name.trim(),
							category: category as AssetCategory,
							assetType,
							ownerCompanyId,
							serialNumber: serialNumber.trim() || null,
							model: model.trim() || null,
							specs: specs.trim() || null,
							purchaseDate: purchaseDate || null,
							purchaseCost: costNum,
							warrantyExpiry: warrantyExpiry || null,
							accountExpiry: accountExpiry || null,
							renewalDate: renewalDate || null,
							notes: notes.trim() || null,
						},
					});

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success("Asset updated successfully");
						onOpenChange(false);
						onSuccess();
					}
				} else {
					const res = await createAsset({
						data: {
							assetTag: assetTag.trim(),
							name: name.trim(),
							category: category as AssetCategory,
							assetType,
							ownerCompanyId,
							serialNumber: serialNumber.trim() || null,
							model: model.trim() || null,
							specs: specs.trim() || null,
							purchaseDate: purchaseDate || null,
							purchaseCost: costNum,
							warrantyExpiry: warrantyExpiry || null,
							accountExpiry: accountExpiry || null,
							renewalDate: renewalDate || null,
							quantity: assetType !== "digital_account" ? quantity : 1,
							notes: notes.trim() || null,
						},
					});

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success(
							quantity > 1
								? `${quantity} items added to inventory`
								: "Asset added to inventory",
						);
						onOpenChange(false);
						onSuccess();
					}
				}
			} catch (_err) {
				toast.error("Failed to save asset");
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Item / Account" : "Add New Item / Account"}
					</DialogTitle>
					<DialogDescription>
						Track capital hardware, peripherals & consumables, or client digital
						accounts.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4.5 py-1">
					{/* Type Selector (3-Tier) */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-muted/60 rounded-lg">
						<button
							type="button"
							onClick={() => {
								setAssetType("capital_asset");
								if (
									category === "digital_account" ||
									category === "accessory"
								) {
									setCategory("laptop");
								}
							}}
							className={`py-2 px-2.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
								assetType === "capital_asset"
									? "bg-background text-foreground font-semibold text-primary"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<Laptop className="size-3.5" /> Capital Hardware
						</button>
						<button
							type="button"
							onClick={() => {
								setAssetType("bulk_peripheral");
								if (category === "digital_account" || category === "laptop") {
									setCategory("accessory");
								}
							}}
							className={`py-2 px-2.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
								assetType === "bulk_peripheral"
									? "bg-background text-foreground font-semibold text-asset-peripheral"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<Package className="size-3.5" /> Peripheral / Stock
						</button>
						<button
							type="button"
							onClick={() => {
								setAssetType("digital_account");
								setCategory("digital_account");
							}}
							className={`py-2 px-2.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
								assetType === "digital_account"
									? "bg-background text-foreground font-semibold text-asset-digital"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<Key className="size-3.5" /> Digital Account
						</button>
					</div>

					{/* Tag, Quantity & Name */}
					<div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
						<div
							className={
								!isEditing && assetType !== "digital_account"
									? "sm:col-span-5 space-y-1.5"
									: "sm:col-span-6 space-y-1.5"
							}
						>
							<Label htmlFor="assetTag">
								{!isEditing && quantity > 1
									? "Tag Base / Prefix"
									: "Asset Tag / Identifier"}{" "}
								<span className="text-destructive">*</span>
							</Label>
							<Input
								id="assetTag"
								value={assetTag}
								onChange={(e) => setAssetTag(e.target.value.toUpperCase())}
								placeholder={
									!isEditing && quantity > 1
										? "e.g. LAP-001 or MBA-"
										: "e.g. LAP-001, CARD-042"
								}
								required
							/>
						</div>

						{!isEditing && assetType !== "digital_account" && (
							<div className="sm:col-span-2 space-y-1.5">
								<Label htmlFor="quantity">Quantity</Label>
								<Input
									id="quantity"
									type="number"
									min={1}
									max={100}
									value={quantity}
									onChange={(e) =>
										setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
									}
								/>
							</div>
						)}

						<div
							className={
								!isEditing && assetType !== "digital_account"
									? "sm:col-span-5 space-y-1.5"
									: "sm:col-span-6 space-y-1.5"
							}
						>
							<Label htmlFor="name">
								Item / Model Name <span className="text-destructive">*</span>
							</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. MacBook Pro 14, Laptop Stand, Client VPN"
								required
							/>
						</div>
					</div>

					{/* Quantity helper note */}
					{!isEditing && assetType !== "digital_account" && quantity > 1 && (
						<div className="text-[11px] text-primary bg-primary/10 rounded-md p-2 border border-primary/20">
							Will create <strong>{quantity} units</strong> in batch starting
							from <strong>{assetTag}</strong>.
						</div>
					)}

					{/* Category & Owner Company */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="category">Category</Label>
							<Select
								value={category}
								onValueChange={(val) => {
									if (val) handleCategoryChange(val);
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select category">
										{(() => {
											const selected = CATEGORY_OPTIONS.find(
												(c) => c.value === category,
											);
											if (!selected) return "Select category";
											const Icon = selected.icon;
											return (
												<div className="flex items-center gap-2">
													<Icon className="size-3.5 text-muted-foreground shrink-0" />
													<span>{selected.label}</span>
												</div>
											);
										})()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
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
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="ownerCompany">
								Owner Company <span className="text-destructive">*</span>
							</Label>
							<Select
								value={ownerCompanyId}
								onValueChange={(val) => {
									if (val) setOwnerCompanyId(val);
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select owner company">
										{(() => {
											const comp = companies.find(
												(c) => c.id === ownerCompanyId,
											);
											if (!comp) return "Select owner company";
											return `${comp.name} ${
												comp.isInternal ? "(Brainee.org - Internal)" : `(${comp.code})`
											}`;
										})()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{companies.map((c) => (
										<SelectItem key={c.id} value={c.id}>
											{c.name}{" "}
											{c.isInternal ? "(Brainee.org - Internal)" : `(${c.code})`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Serial Number / Username & Model */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="serialNumber">
								{assetType === "digital_account"
									? "Username / Account ID / Email"
									: "Serial Number / RFID / Barcode"}
							</Label>
							<Input
								id="serialNumber"
								value={serialNumber}
								onChange={(e) => setSerialNumber(e.target.value)}
								placeholder={
									assetType === "digital_account"
										? "e.g. user@clientb.com"
										: "e.g. C02G99XZMD6R"
								}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="model">
								{assetType === "digital_account"
									? "Platform / Service"
									: "Model / Brand"}
							</Label>
							<Input
								id="model"
								value={model}
								onChange={(e) => setModel(e.target.value)}
								placeholder="e.g. Apple M3 Pro, AWS IAM, Dell 27"
							/>
						</div>
					</div>

					{/* Specs / Configuration */}
					<div className="space-y-1.5">
						<Label htmlFor="specs">Specs / Details</Label>
						<Input
							id="specs"
							value={specs}
							onChange={(e) => setSpecs(e.target.value)}
							placeholder="e.g. 18GB RAM, 512GB SSD, Space Black / Admin permissions"
						/>
					</div>

					{/* Dates Section */}
					{assetType !== "digital_account" ? (
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div className="space-y-1.5">
								<Label htmlFor="purchaseDate">Purchase Date</Label>
								<Input
									id="purchaseDate"
									type="date"
									value={purchaseDate}
									onChange={(e) => setPurchaseDate(e.target.value)}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="purchaseCost">Purchase Cost ($)</Label>
								<Input
									id="purchaseCost"
									type="number"
									step="0.01"
									value={purchaseCost}
									onChange={(e) => setPurchaseCost(e.target.value)}
									placeholder="0.00"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
								<Input
									id="warrantyExpiry"
									type="date"
									value={warrantyExpiry}
									onChange={(e) => setWarrantyExpiry(e.target.value)}
								/>
							</div>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<Label htmlFor="renewalDate">Next Renewal Date</Label>
								<Input
									id="renewalDate"
									type="date"
									value={renewalDate}
									onChange={(e) => setRenewalDate(e.target.value)}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="accountExpiry">Account Expiration Date</Label>
								<Input
									id="accountExpiry"
									type="date"
									value={accountExpiry}
									onChange={(e) => setAccountExpiry(e.target.value)}
								/>
							</div>
						</div>
					)}

					{/* Notes */}
					<div className="space-y-1.5">
						<Label htmlFor="notes">Notes / Warranty Ref</Label>
						<Textarea
							id="notes"
							rows={2}
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Invoice reference, supplier info, or special instructions..."
						/>
					</div>

					<DialogFooter className="pt-4 border-t border-border/40 flex items-center justify-end gap-2.5">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending
								? isEditing
									? "Saving..."
									: "Adding..."
								: isEditing
									? "Save Changes"
									: "Add to Inventory"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
