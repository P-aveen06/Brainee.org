"use client";

import { format, parseISO } from "date-fns";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

interface ChartDataPoint {
	date: string;
	hours: number;
}

interface StatsTimelineChartProps {
	data: ChartDataPoint[];
}

const formatXAxis = (tickItem: string) => {
	try {
		return format(parseISO(tickItem), "MMM d");
	} catch {
		return tickItem;
	}
};

interface CustomTooltipProps {
	active?: boolean;
	payload?: { value: number }[];
	label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
	if (active && payload && payload.length && label) {
		const val = payload[0].value;
		return (
			<div className="rounded-xl border border-border bg-popover/95 p-3 shadow-lg backdrop-blur-md text-xs space-y-1.5 min-w-[140px]">
				<div className="flex items-center justify-between gap-3 text-muted-foreground font-medium border-b border-border/50 pb-1">
					<span>{formatXAxis(label)}</span>
					<span className="font-mono text-[10px] opacity-75">{label}</span>
				</div>
				<div className="flex items-baseline justify-between gap-2 pt-0.5">
					<span className="text-muted-foreground text-[11px]">Logged</span>
					<div className="flex items-baseline gap-1">
						<span className="text-foreground font-bold font-mono text-base">
							{val}
						</span>
						<span className="text-[11px] text-muted-foreground">hrs</span>
					</div>
				</div>
			</div>
		);
	}
	return null;
};

export default function StatsTimelineChart({ data }: StatsTimelineChartProps) {
	const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));

	const totalHours = sortedData.reduce((s, d) => s + d.hours, 0);
	const avgHours =
		sortedData.length > 0
			? Math.round((totalHours / sortedData.length) * 10) / 10
			: 0;

	return (
		<div className="h-[280px] w-full">
			<ResponsiveContainer
				width="100%"
				height="100%"
				minWidth={0}
				initialDimension={{ width: 320, height: 280 }}
			>
				<AreaChart
					data={sortedData}
					margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
				>
					<defs>
						<linearGradient id="fancyHoursGradient" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
							<stop offset="50%" stopColor="var(--accent)" stopOpacity={0.12} />
							<stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid
						strokeDasharray="3 3"
						vertical={false}
						stroke="currentColor"
						className="stroke-border/40"
					/>
					<XAxis
						dataKey="date"
						tickFormatter={formatXAxis}
						fontSize={11}
						tickLine={false}
						axisLine={false}
						dy={10}
						className="fill-muted-foreground"
					/>
					<YAxis
						fontSize={11}
						tickLine={false}
						axisLine={false}
						dx={-6}
						className="fill-muted-foreground"
					/>
					<Tooltip
						content={<CustomTooltip />}
						animationDuration={100}
						animationEasing="ease-out"
						isAnimationActive={true}
					/>
					{avgHours > 0 && (
						<ReferenceLine
							y={avgHours}
							stroke="currentColor"
							strokeDasharray="4 4"
							className="stroke-muted-foreground/60"
							label={{
								value: `Avg: ${avgHours}h`,
								position: "insideTopRight",
								fill: "currentColor",
								fontSize: 10,
								fontWeight: 500,
								className: "fill-muted-foreground",
							}}
						/>
					)}
					<Area
						type="monotone"
						dataKey="hours"
						stroke="var(--accent)"
						strokeWidth={2.5}
						fillOpacity={1}
						fill="url(#fancyHoursGradient)"
						activeDot={{
							r: 5,
							fill: "var(--accent)",
							stroke: "var(--background)",
							strokeWidth: 2,
						}}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
