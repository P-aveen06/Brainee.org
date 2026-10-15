"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import type { ProjectExecutiveSummary } from "@/lib/detailed-admin-stats.server";

interface ProjectDeliverablesDonutChartProps {
	projects: ProjectExecutiveSummary[];
}

const PALETTE = [
	"#3b82f6", // Blue
	"#8b5cf6", // Violet
	"#10b981", // Emerald
	"#f59e0b", // Amber
	"#06b6d4", // Cyan
	"#ec4899", // Pink
	"#64748b", // Slate
];

export default function ProjectDeliverablesDonutChart({
	projects,
}: ProjectDeliverablesDonutChartProps) {
	// Filter to projects with tasks and sort by total tasks descending
	const validProjects = projects
		.filter((p) => p.totalTasks > 0)
		.sort((a, b) => b.totalTasks - a.totalTasks);

	const totalTasksAcrossProjects = validProjects.reduce(
		(sum, p) => sum + p.totalTasks,
		0,
	);

	const chartData = validProjects.map((p, idx) => ({
		id: p.id,
		code: p.code,
		name: p.name,
		client: p.clientName || "Internal",
		value: p.totalTasks,
		open: p.openTasks,
		blocked: p.blockedTasks,
		health: p.health,
		color: PALETTE[idx % PALETTE.length],
		percent:
			totalTasksAcrossProjects > 0
				? Math.round((p.totalTasks / totalTasksAcrossProjects) * 100)
				: 0,
	}));

	if (chartData.length === 0) {
		return (
			<div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
				No active deliverables recorded across projects.
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4 h-[280px]">
			{/* Left: Recharts Donut */}
			<div className="relative md:col-span-6 h-[240px] flex items-center justify-center">
				<ResponsiveContainer
					width="100%"
					height="100%"
					minWidth={0}
					initialDimension={{ width: 240, height: 240 }}
				>
					<PieChart>
						<Tooltip
							animationDuration={100}
							animationEasing="ease-out"
							isAnimationActive={true}
							content={({ active, payload }) => {
								if (active && payload && payload.length) {
									const d = payload[0].payload;
									return (
										<div className="rounded-xl border border-border bg-popover/95 p-3 shadow-lg backdrop-blur-md text-xs space-y-1.5 min-w-[160px]">
											<div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
												<span className="font-semibold text-foreground">
													[{d.code}] {d.name}
												</span>
											</div>
											<div className="text-[11px] text-muted-foreground">
												Client:{" "}
												<span className="text-foreground">{d.client}</span>
											</div>
											<div className="flex items-center justify-between text-xs pt-1">
												<span className="text-muted-foreground">
													Total Tasks:
												</span>
												<span className="font-bold font-mono text-foreground">
													{d.value} ({d.percent}%)
												</span>
											</div>
											<div className="flex items-center justify-between text-xs">
												<span className="text-muted-foreground">
													Open / Active:
												</span>
												<span className="font-mono text-foreground">
													{d.open}
												</span>
											</div>
											{d.blocked > 0 && (
												<div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-semibold font-mono">
													<span>Blocked:</span>
													<span>{d.blocked}</span>
												</div>
											)}
										</div>
									);
								}
								return null;
							}}
						/>
						<Pie
							data={chartData}
							dataKey="value"
							nameKey="code"
							cx="50%"
							cy="50%"
							innerRadius={58}
							outerRadius={86}
							paddingAngle={3}
							stroke="var(--background)"
							strokeWidth={2}
						>
							{chartData.map((entry) => (
								<Cell key={entry.id} fill={entry.color} />
							))}
						</Pie>
					</PieChart>
				</ResponsiveContainer>

				{/* Center Stat inside the Donut */}
				<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
					<span className="text-2xl font-bold font-mono text-foreground leading-none">
						{totalTasksAcrossProjects}
					</span>
					<span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-1">
						Deliverables
					</span>
				</div>
			</div>

			{/* Right: Interactive Legend with Project Breakdown */}
			<div className="md:col-span-6 space-y-2 max-h-[250px] overflow-y-auto pr-1">
				{chartData.map((item) => (
					<div
						key={item.id}
						className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-muted/40 transition-colors text-xs"
					>
						<div className="flex items-center gap-2 min-w-0">
							<div
								className="size-2.5 rounded-full shrink-0"
								style={{ backgroundColor: item.color }}
							/>
							<div className="min-w-0">
								<div className="flex items-center gap-1.5">
									<span className="font-mono font-semibold text-foreground">
										[{item.code}]
									</span>
									<span className="truncate text-muted-foreground text-[11px]">
										{item.name}
									</span>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2 shrink-0">
							<span className="font-mono font-medium text-foreground text-xs">
								{item.value} ({item.percent}%)
							</span>
							{item.blocked > 0 ? (
								<Badge
									variant="outline"
									className="border-amber-500/30 text-amber-700 bg-amber-500/10 text-[10px] px-1 py-0 font-mono"
								>
									⚠️ {item.blocked}
								</Badge>
							) : (
								<span className="text-[10px] text-emerald-600 font-mono">
									✓ OK
								</span>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
