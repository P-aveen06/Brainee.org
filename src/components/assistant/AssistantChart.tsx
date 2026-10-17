"use client";

import { format, parseISO } from "date-fns";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { AssistantChartSpec } from "@/lib/ai/chart-types";

const COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

function formatCategory(value: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	try {
		return format(parseISO(value), "MMM d");
	} catch {
		return value;
	}
}

function chartRows(chart: AssistantChartSpec) {
	return chart.categories.map((category, index) => {
		const row: Record<string, string | number> = { category };
		for (const [seriesIndex, series] of chart.series.entries()) {
			row[`series${seriesIndex}`] = series.values[index];
		}
		return row;
	});
}

function AssistantChartPlot({ chart }: { chart: AssistantChartSpec }) {
	const data = chartRows(chart);
	const commonAxis = {
		fontSize: 11,
		tickLine: false,
		axisLine: false,
		className: "fill-muted-foreground",
	} as const;

	if (chart.type === "donut") {
		const values = chart.categories.map((category, index) => ({
			category,
			value: chart.series[0].values[index],
			color: COLORS[index % COLORS.length],
		}));
		const visibleValues = values.filter((item) => item.value > 0);
		return (
			<div>
				<div className="h-[210px] w-full" role="img" aria-label={chart.title}>
					<ResponsiveContainer width="100%" height="100%" minWidth={0}>
						<PieChart>
							<Tooltip
								contentStyle={{
									borderRadius: "var(--radius-lg)",
									borderColor: "var(--border)",
									backgroundColor: "var(--popover)",
									fontSize: 12,
								}}
							/>
							<Pie
								data={visibleValues}
								dataKey="value"
								nameKey="category"
								cx="50%"
								cy="50%"
								innerRadius={55}
								outerRadius={82}
								paddingAngle={2}
								stroke="var(--background)"
							>
								{visibleValues.map((item) => (
									<Cell key={item.category} fill={item.color} />
								))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
				</div>
				<ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
					{values.map((item) => (
						<li key={item.category} className="flex min-w-0 items-center gap-2">
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: item.color }}
							/>
							<span className="min-w-0 flex-1 truncate text-muted-foreground">
								{item.category}
							</span>
							<span className="font-mono font-medium text-foreground">
								{item.value}
							</span>
						</li>
					))}
				</ul>
			</div>
		);
	}

	return (
		<div className="h-[250px] w-full" role="img" aria-label={chart.title}>
			<ResponsiveContainer width="100%" height="100%" minWidth={0}>
				{chart.type === "line" ? (
					<LineChart
						data={data}
						margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
					>
						<CartesianGrid
							vertical={false}
							strokeDasharray="3 3"
							className="stroke-border/50"
						/>
						<XAxis
							dataKey="category"
							tickFormatter={formatCategory}
							interval="preserveStartEnd"
							{...commonAxis}
						/>
						<YAxis width={36} allowDecimals={false} {...commonAxis} />
						<Tooltip
							labelFormatter={(label) => formatCategory(String(label))}
							contentStyle={{
								borderRadius: "var(--radius-lg)",
								borderColor: "var(--border)",
								backgroundColor: "var(--popover)",
								fontSize: 12,
							}}
						/>
						<Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
						{chart.series.map((series, index) => (
							<Line
								key={series.name}
								type="monotone"
								dataKey={`series${index}`}
								name={series.name}
								stroke={COLORS[index % COLORS.length]}
								strokeWidth={2}
								dot={{ r: 3 }}
							/>
						))}
					</LineChart>
				) : (
					<BarChart
						data={data}
						margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
					>
						<CartesianGrid
							vertical={false}
							strokeDasharray="3 3"
							className="stroke-border/50"
						/>
						<XAxis
							dataKey="category"
							tickFormatter={formatCategory}
							interval="preserveStartEnd"
							{...commonAxis}
						/>
						<YAxis width={36} allowDecimals={false} {...commonAxis} />
						<Tooltip
							labelFormatter={(label) => formatCategory(String(label))}
							contentStyle={{
								borderRadius: "var(--radius-lg)",
								borderColor: "var(--border)",
								backgroundColor: "var(--popover)",
								fontSize: 12,
							}}
						/>
						<Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
						{chart.series.map((series, index) => (
							<Bar
								key={series.name}
								dataKey={`series${index}`}
								name={series.name}
								fill={COLORS[index % COLORS.length]}
								radius={[4, 4, 0, 0]}
							/>
						))}
					</BarChart>
				)}
			</ResponsiveContainer>
			<div className="sr-only">
				{chart.categories
					.map(
						(category, index) =>
							`${formatCategory(category)}: ${chart.series
								.map((series) => `${series.name} ${series.values[index]}`)
								.join(", ")}`,
					)
					.join("; ")}
			</div>
		</div>
	);
}

export function AssistantChart({ chart }: { chart: AssistantChartSpec }) {
	return (
		<section
			className="my-3 max-w-3xl rounded-xl border border-border bg-card p-3 shadow-xs"
			aria-label={chart.title}
		>
			<div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h3 className="text-sm font-semibold tracking-tight text-foreground">
					{chart.title}
				</h3>
				<span className="text-[11px] text-muted-foreground">
					{chart.scope} · As of {formatCategory(chart.asOf)}
				</span>
			</div>
			<AssistantChartPlot chart={chart} />
			{chart.note && (
				<p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
					{chart.note}
				</p>
			)}
		</section>
	);
}
