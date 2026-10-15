"use client";

import { AlertTriangle, Clock, ListChecks, PlayCircle } from "lucide-react";
import { StatCard, StatGroup } from "@/components/ui/stat-card";

interface MyTasksKpiGridProps {
	summary: {
		total: number;
		overdue: number;
		dueToday: number;
		inProgress: number;
	};
}

export function MyTasksKpiGrid({ summary }: MyTasksKpiGridProps) {
	return (
		<StatGroup>
			<StatCard
				label="Total Assigned"
				value={summary.total}
				icon={ListChecks}
			/>
			<StatCard
				label="Overdue"
				value={summary.overdue}
				icon={AlertTriangle}
				highlight={summary.overdue > 0}
			/>
			<StatCard label="Due Today" value={summary.dueToday} icon={Clock} />
			<StatCard
				label="In Progress"
				value={summary.inProgress}
				icon={PlayCircle}
			/>
		</StatGroup>
	);
}
