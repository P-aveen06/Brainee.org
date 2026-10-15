import {
	AlertTriangle,
	Archive,
	ArrowLeftRight,
	Ban,
	CheckCircle2,
	Clock,
	Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AssetStatus =
	| "in_inventory"
	| "assigned"
	| "maintenance"
	| "defective"
	| "replaced"
	| "disposed"
	| "returned_to_client";

export const STATUS_CONFIG: Record<
	AssetStatus,
	{ label: string; icon: typeof CheckCircle2; className: string }
> = {
	in_inventory: {
		label: "In Inventory",
		icon: CheckCircle2,
		className: "bg-success/10 text-success border-success/20",
	},
	assigned: {
		label: "Assigned",
		icon: Clock,
		className: "bg-info/10 text-info border-info/20",
	},
	maintenance: {
		label: "In Maintenance",
		icon: Wrench,
		className: "bg-warning/10 text-warning border-warning/20",
	},
	defective: {
		label: "Defective",
		icon: AlertTriangle,
		className: "bg-destructive/10 text-destructive border-destructive/20",
	},
	replaced: {
		label: "Replaced",
		icon: ArrowLeftRight,
		className:
			"bg-status-holiday text-status-holiday-foreground border-status-holiday-foreground/20",
	},
	disposed: {
		label: "Disposed / Scrapped",
		icon: Ban,
		className: "bg-muted text-muted-foreground border-border",
	},
	returned_to_client: {
		label: "Returned to Client",
		icon: Archive,
		className: "bg-info/10 text-info border-info/20",
	},
};

export function AssetStatusBadge({
	status,
	className,
}: {
	status: string;
	className?: string;
}) {
	const config =
		STATUS_CONFIG[status as AssetStatus] || STATUS_CONFIG.in_inventory;
	const Icon = config.icon;

	return (
		<Badge
			variant="outline"
			className={cn(
				"font-mono text-xs font-medium gap-1 px-2 py-0.5",
				config.className,
				className,
			)}
		>
			<Icon className="size-3" />
			<span>{config.label}</span>
		</Badge>
	);
}
