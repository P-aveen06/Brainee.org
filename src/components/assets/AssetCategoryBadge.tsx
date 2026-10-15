import {
	CreditCard,
	Headphones,
	Key,
	Laptop,
	Monitor,
	Package,
	Smartphone,
	Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AssetCategory =
	| "laptop"
	| "charger"
	| "bag"
	| "monitor"
	| "id_card"
	| "phone"
	| "digital_account"
	| "accessory"
	| "other";

export const CATEGORY_CONFIG: Record<
	AssetCategory,
	{ label: string; icon: typeof Laptop; className: string }
> = {
	laptop: {
		label: "Laptop",
		icon: Laptop,
		className: "bg-asset-capital/10 text-asset-capital",
	},
	charger: {
		label: "Charger",
		icon: Zap,
		className: "bg-warning/10 text-warning",
	},
	bag: {
		label: "Bag / Backpack",
		icon: Package,
		className: "bg-asset-peripheral/10 text-asset-peripheral",
	},
	monitor: {
		label: "Monitor",
		icon: Monitor,
		className: "bg-info/10 text-info",
	},
	id_card: {
		label: "ID Card / Badge",
		icon: CreditCard,
		className: "bg-success/10 text-success",
	},
	phone: {
		label: "Mobile Phone",
		icon: Smartphone,
		className: "bg-status-holiday text-status-holiday-foreground",
	},
	digital_account: {
		label: "Account / License",
		icon: Key,
		className: "bg-asset-digital/10 text-asset-digital",
	},
	accessory: {
		label: "Accessory",
		icon: Headphones,
		className: "bg-info/10 text-info",
	},
	other: {
		label: "Other Item",
		icon: Package,
		className: "bg-muted text-muted-foreground",
	},
};

export const CATEGORY_OPTIONS = (
	Object.keys(CATEGORY_CONFIG) as AssetCategory[]
).map((key) => ({
	value: key,
	label: CATEGORY_CONFIG[key].label,
	icon: CATEGORY_CONFIG[key].icon,
}));

export function getCategoryLabel(category: string): string {
	return CATEGORY_CONFIG[category as AssetCategory]?.label || category;
}

export function AssetCategoryBadge({
	category,
	className,
}: {
	category: string;
	className?: string;
}) {
	const config =
		CATEGORY_CONFIG[category as AssetCategory] || CATEGORY_CONFIG.other;
	const Icon = config.icon;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-transparent transition-colors",
				config.className,
				className,
			)}
		>
			<Icon className="size-3 shrink-0" />
			<span>{config.label}</span>
		</span>
	);
}

export type AssetTier =
	| "capital_asset"
	| "bulk_peripheral"
	| "digital_account"
	| "physical";

export function getTierConfig(tier?: string | null) {
	if (tier === "bulk_peripheral") {
		return {
			label: "Peripheral / Stock",
			className:
				"bg-asset-peripheral/10 text-asset-peripheral border-asset-peripheral/30",
		};
	}
	if (tier === "digital_account") {
		return {
			label: "Digital Account",
			className:
				"bg-asset-digital/10 text-asset-digital border-asset-digital/30",
		};
	}
	return {
		label: "Capital Hardware",
		className: "bg-asset-capital/10 text-asset-capital border-asset-capital/30",
	};
}

export function AssetTierBadge({
	tier,
	className,
}: {
	tier?: string | null;
	className?: string;
}) {
	const config = getTierConfig(tier);

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold border",
				config.className,
				className,
			)}
		>
			{config.label}
		</span>
	);
}
