import { CalendarOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { DashboardExtras } from "#/lib/dashboard-extras.server";
import type { PersonalStats } from "#/lib/dashboard-stats.server";
import { formatLeaveType } from "#/lib/leave-policy";
import { cn } from "#/lib/utils";
import { Tile } from "./Tile";

const MAX_BARS = 5;
const CHART_HEIGHT = 104;
const MIN_BOX_PX = 20;
const GAP_PX = 4;
const COLOR = "var(--accent)";

interface Row {
	key: string;
	label: string;
	total: number;
	used: number;
}

function computeBoxHeights(left: number, used: number, total: number) {
	if (total <= 0) return { leftPx: 0, usedPx: 0 };
	if (left <= 0 && used <= 0) return { leftPx: 0, usedPx: 0 };
	if (left <= 0) return { leftPx: 0, usedPx: CHART_HEIGHT };
	if (used <= 0) return { leftPx: CHART_HEIGHT, usedPx: 0 };

	const usable = CHART_HEIGHT - GAP_PX;
	let leftPx = Math.round((left / total) * usable);
	let usedPx = usable - leftPx;

	if (leftPx < MIN_BOX_PX) {
		leftPx = MIN_BOX_PX;
		usedPx = usable - leftPx;
	} else if (usedPx < MIN_BOX_PX) {
		usedPx = MIN_BOX_PX;
		leftPx = usable - usedPx;
	}

	return { leftPx, usedPx };
}

function Segment({
	value,
	px,
	hatched,
	delay,
	ready,
}: {
	value: number;
	px: number;
	hatched?: boolean;
	delay: number;
	ready: boolean;
}) {
	if (value <= 0) return null;
	return (
		<div
			className={cn(
				"flex w-full items-center justify-center overflow-hidden rounded-md text-[11px] font-semibold transition-[height,opacity,transform,filter] duration-500 ease-bounce hover:brightness-115 hover:scale-[1.04] hover:shadow-md cursor-pointer",
				hatched
					? "hatch-fill border border-border/70 text-foreground"
					: "text-white shadow-xs",
			)}
			style={{
				height: ready ? px : 0,
				opacity: ready ? 1 : 0,
				color: hatched ? COLOR : undefined,
				backgroundColor: hatched ? undefined : COLOR,
				backgroundImage: hatched ? undefined : "var(--accent-gradient)",
				transitionDelay: `${delay}ms`,
			}}
		>
			<span
				className={cn(
					"leading-none transition-opacity duration-300",
					ready ? "opacity-100" : "opacity-0",
					hatched &&
						"rounded bg-card/90 px-1 py-px text-[10px] font-semibold text-foreground shadow-2xs",
				)}
			>
				{value}
			</span>
		</div>
	);
}

/**
 * Two separate stacked boxes per allowance:
 * top box is hatched (used days), bottom box is solid (days left).
 */
import type { WidgetSize } from "#/lib/dashboard-layout";

export function LeaveTile({
	stats,
	wfhBalance,
	size = "sm",
}: {
	stats: PersonalStats;
	wfhBalance: DashboardExtras["wfhBalance"];
	size?: WidgetSize;
}) {
	const [ready, setReady] = useState(false);
	useEffect(() => {
		const timer = setTimeout(() => setReady(true), 220);
		return () => clearTimeout(timer);
	}, []);

	const rows: Row[] = [
		...stats.leaveBalanceBreakdown.map((b) => ({
			key: b.leaveType,
			label: formatLeaveType(b.leaveType).replace(/ Leave$/, ""),
			total: b.total,
			used: b.used,
		})),
		...(wfhBalance
			? [
					{
						key: "wfh",
						label: "WFH",
						total: wfhBalance.total,
						used: wfhBalance.used,
					},
				]
			: []),
	]
		.filter((r) => r.total > 0)
		.slice(0, MAX_BARS);

	if (rows.length === 0) {
		return (
			<Tile title="Leave & WFH" icon={CalendarOff}>
				<div className="flex h-full min-h-[140px] flex-col items-center justify-center p-4 text-center">
					<div className="mb-2 flex size-9 items-center justify-center rounded-full bg-surface-alt text-muted-foreground">
						<CalendarOff className="size-4" />
					</div>
					<p className="text-xs font-semibold text-foreground">
						No leave balances
					</p>
					<p className="mt-0.5 text-[11px] text-muted-foreground">
						No leave or WFH policies assigned for this cycle
					</p>
				</div>
			</Tile>
		);
	}

	const chartContent = (
		<div className="flex items-end gap-2.5">
			{rows.map((r, i) => {
				const used = Math.min(r.used, r.total);
				const left = r.total - used;
				const { leftPx, usedPx } = computeBoxHeights(left, used, r.total);
				return (
					<div
						key={r.key}
						className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
						title={`${r.label}: ${left} of ${r.total} left`}
					>
						<div
							className="flex w-full flex-col justify-end gap-1"
							style={{ height: CHART_HEIGHT }}
						>
							<Segment
								value={used}
								px={usedPx}
								hatched
								delay={i * 80 + 120}
								ready={ready}
							/>
							<Segment value={left} px={leftPx} delay={i * 80} ready={ready} />
						</div>
						<span className="w-full truncate text-center text-[10px] font-medium text-muted-foreground">
							{r.label}
						</span>
					</div>
				);
			})}
		</div>
	);

	const legendContent = (
		<ul className="mt-2.5 flex gap-3 text-[11px] text-muted-foreground">
			<li className="flex items-center gap-1.5">
				<span
					className="bg-accent-gradient size-2.5 rounded-sm shadow-2xs"
					aria-hidden="true"
				/>
				Left
			</li>
			<li className="flex items-center gap-1.5">
				<span
					className="hatch-fill size-2.5 rounded-sm border border-border/70"
					style={{ color: COLOR }}
					aria-hidden="true"
				/>
				Used
			</li>
		</ul>
	);

	if (size === "lg") {
		return (
			<Tile title="Leave & WFH" icon={CalendarOff}>
				<div className="grid h-full grid-cols-1 items-center gap-6 lg:grid-cols-[240px_1fr]">
					<div>
						{chartContent}
						{legendContent}
					</div>
					<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
						{rows.map((r) => {
							const used = Math.min(r.used, r.total);
							const left = r.total - used;
							return (
								<div
									key={r.key}
									className="rounded-xl border border-border/60 bg-surface-alt/50 p-3"
								>
									<p className="truncate text-xs font-semibold text-foreground">
										{r.label}
									</p>
									<div className="mt-2 flex items-baseline gap-1">
										<span className="font-heading text-2xl font-bold leading-none text-foreground">
											{left}
										</span>
										<span className="text-[11px] text-muted-foreground">
											/ {r.total} left
										</span>
									</div>
									<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-accent-gradient transition-[width] duration-700 ease-bounce"
											style={{
												width:
													ready && r.total ? `${(left / r.total) * 100}%` : 0,
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</Tile>
		);
	}

	return (
		<Tile title="Leave & WFH" icon={CalendarOff}>
			{chartContent}
			<div className="flex items-center justify-between">
				{legendContent}
				{size === "md" && (
					<div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
						{rows.map((r) => (
							<span
								key={r.key}
								className="rounded bg-surface-alt px-1.5 py-0.5 font-medium"
							>
								{r.label.slice(0, 3)}: {r.total - Math.min(r.used, r.total)}
							</span>
						))}
					</div>
				)}
			</div>
		</Tile>
	);
}
