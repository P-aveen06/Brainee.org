import {
	AlertTriangle,
	Boxes,
	CalendarClock,
	CheckCircle2,
	Users,
} from "lucide-react";
import { StatCard, StatGroup } from "@/components/ui/stat-card";

interface AssetSummaryStats {
	total: number;
	inInventory: number;
	assigned: number;
	defective: number;
	disposed: number;
	expiringAccounts: number;
}

interface AssetStatsCardsProps {
	summary: AssetSummaryStats;
}

export function AssetStatsCards({ summary }: AssetStatsCardsProps) {
	const cards = [
		{
			key: "all",
			label: "Total Assets & Accounts",
			count: summary.total,
			icon: Boxes,
			highlight: false,
		},
		{
			key: "in_inventory",
			label: "Available in Inventory",
			count: summary.inInventory,
			icon: CheckCircle2,
			highlight: false,
		},
		{
			key: "assigned",
			label: "Currently Assigned",
			count: summary.assigned,
			icon: Users,
			highlight: false,
		},
		{
			key: "defective",
			label: "Defective / Maint",
			count: summary.defective,
			icon: AlertTriangle,
			highlight: summary.defective > 0,
		},
		{
			key: "expiring",
			label: "Expiring Accounts (30d)",
			count: summary.expiringAccounts,
			icon: CalendarClock,
			highlight: summary.expiringAccounts > 0,
		},
	];

	return (
		<StatGroup columns={5}>
			{cards.map((card) => (
				<StatCard
					key={card.key}
					label={card.label}
					value={card.count}
					icon={card.icon}
					highlight={card.highlight}
				/>
			))}
		</StatGroup>
	);
}
