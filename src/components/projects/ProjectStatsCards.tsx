import {
	AlertTriangle,
	CheckCircle2,
	FolderKanban,
	PlayCircle,
} from "lucide-react";
import { StatCard, StatGroup } from "@/components/ui/stat-card";

interface ProjectStatsCardsProps {
	summary: {
		total: number;
		active: number;
		onTrack: number;
		atRisk: number;
	};
}

export function ProjectStatsCards({ summary }: ProjectStatsCardsProps) {
	return (
		<StatGroup>
			<StatCard
				label="Total Projects"
				value={summary.total}
				icon={FolderKanban}
			/>
			<StatCard label="Active" value={summary.active} icon={PlayCircle} />
			<StatCard label="On Track" value={summary.onTrack} icon={CheckCircle2} />
			<StatCard
				label="At Risk"
				value={summary.atRisk}
				icon={AlertTriangle}
				highlight={summary.atRisk > 0}
			/>
		</StatGroup>
	);
}
