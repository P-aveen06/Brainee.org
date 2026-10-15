import { Clock, Flame } from "lucide-react";
import { AnimatedNumber } from "#/components/motion";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import type { WidgetSize } from "#/lib/dashboard-layout";
import { countWorkdays } from "#/lib/dashboard-summary";
import { buildHeatmapWeeks, computeStreak } from "#/lib/hours-heatmap";
import { getTodayIsoDate } from "#/lib/leave-policy";
import { cn } from "#/lib/utils";
import { HoursHeatmap } from "./HoursHeatmap";
import { Tile } from "./Tile";

export function HoursTile({
	hoursThisMonth,
	standardHours,
	trend,
	offDates,
	size = "sm",
}: {
	hoursThisMonth: number;
	standardHours: number;
	trend: { date: string; hours: number }[];
	offDates: string[];
	size?: WidgetSize;
}) {
	const now = new Date();
	const today = getTodayIsoDate();
	const totalWorkdays = countWorkdays(now.getFullYear(), now.getMonth());
	const target = standardHours * totalWorkdays;
	const pct = target > 0 ? Math.round((hoursThisMonth / target) * 100) : 0;

	const input = {
		today,
		hoursByDate: new Map(trend.map((t) => [t.date, t.hours])),
		offDates: new Set(offDates),
		standardHours,
	};
	const weeks = buildHeatmapWeeks(today.slice(0, 7), input);
	const streak = computeStreak(input);

	const loggedDaysCount = trend.filter((t) => t.hours > 0).length;
	const dailyAvg =
		loggedDaysCount > 0 ? (hoursThisMonth / loggedDaysCount).toFixed(1) : "0";

	if (size === "lg") {
		return (
			<Tile title="Hours this month" icon={Clock}>
				<div className="grid h-full grid-cols-1 items-center gap-6 lg:grid-cols-[260px_1fr]">
					<div className="space-y-3">
						<div className="flex items-baseline gap-1.5">
							<span className="font-heading text-3xl font-bold leading-none tracking-[-0.04em]">
								<AnimatedNumber value={hoursThisMonth} />
							</span>
							<span className="text-sm text-muted-foreground">
								/ {target} hrs target
							</span>
						</div>
						<Tooltip>
							<TooltipTrigger
								render={
									<div className="space-y-1 cursor-pointer group/goal">
										<div className="flex justify-between text-xs text-muted-foreground transition-colors group-hover/goal:text-foreground">
											<span>Monthly goal</span>
											<span className="font-semibold text-foreground">
												{pct}%
											</span>
										</div>
										<div className="h-2 overflow-hidden rounded-full bg-muted transition-all duration-150 group-hover/goal:ring-2 group-hover/goal:ring-accent/30 group-hover/goal:scale-y-125">
											<div
												className="h-full rounded-full bg-accent-gradient transition-[width] duration-700 ease-bounce"
												style={{ width: `${Math.min(pct, 100)}%` }}
											/>
										</div>
									</div>
								}
							/>
							<TooltipContent
								side="top"
								sideOffset={6}
								className="text-xs px-2.5 py-1"
							>
								<span className="font-semibold text-foreground">
									{hoursThisMonth}
								</span>
								<span className="text-muted-foreground"> of </span>
								<span className="font-semibold text-foreground">
									{target} hrs
								</span>
								<span className="text-muted-foreground"> ({pct}%)</span>
							</TooltipContent>
						</Tooltip>
						<div className="grid grid-cols-3 gap-2 pt-1">
							<div className="rounded-lg bg-surface-alt p-2 text-center transition-colors duration-150 hover:bg-surface-alt/80 cursor-default">
								<p className="text-[10px] text-muted-foreground">Streak</p>
								<p className="flex items-center justify-center gap-1 font-semibold text-foreground text-xs">
									<Flame className="size-3 text-amber-500" />
									{streak}d
								</p>
							</div>
							<div className="rounded-lg bg-surface-alt p-2 text-center transition-colors duration-150 hover:bg-surface-alt/80 cursor-default">
								<p className="text-[10px] text-muted-foreground">Daily Avg</p>
								<p className="font-semibold text-foreground text-xs">
									{dailyAvg}h
								</p>
							</div>
							<div className="rounded-lg bg-surface-alt p-2 text-center transition-colors duration-150 hover:bg-surface-alt/80 cursor-default">
								<p className="text-[10px] text-muted-foreground">Days Logged</p>
								<p className="font-semibold text-foreground text-xs">
									{loggedDaysCount}/{totalWorkdays}
								</p>
							</div>
						</div>
					</div>
					<div className="min-w-0">
						<HoursHeatmap weeks={weeks} today={today} />
					</div>
				</div>
			</Tile>
		);
	}

	return (
		<Tile title="Hours this month" icon={Clock}>
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<p className="flex items-baseline gap-1.5">
					<span className="font-heading text-2xl font-bold leading-none tracking-[-0.04em]">
						<AnimatedNumber value={hoursThisMonth} />
					</span>
					<span className="text-xs text-muted-foreground">/ {target} hrs</span>
				</p>
				<p className="flex items-center gap-1 text-xs text-muted-foreground">
					<Flame
						className={cn(
							"size-3.5",
							streak >= 3 ? "text-amber-500" : "text-muted-foreground/60",
						)}
						aria-hidden="true"
					/>
					{streak > 0 ? (
						<span>
							<span className="font-semibold text-foreground">
								{streak}-day
							</span>{" "}
							streak
						</span>
					) : (
						<span>No streak yet</span>
					)}
				</p>
			</div>
			<div className="mt-3">
				<HoursHeatmap weeks={weeks} today={today} />
			</div>
			{size === "md" && (
				<div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
					<span>
						Avg:{" "}
						<span className="font-medium text-foreground">{dailyAvg}h/day</span>
					</span>
					<span>
						Target: <span className="font-medium text-foreground">{pct}%</span>
					</span>
					<span>
						Logged:{" "}
						<span className="font-medium text-foreground">
							{loggedDaysCount}d
						</span>
					</span>
				</div>
			)}
		</Tile>
	);
}
