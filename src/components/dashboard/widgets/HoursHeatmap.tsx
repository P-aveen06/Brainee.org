import type { CellState, HeatCell } from "#/lib/hours-heatmap";
import { cn } from "#/lib/utils";

const ROW_LABELS = ["M", "T", "W", "T", "F"];

const STATE_CLASS: Record<CellState, string> = {
	future:
		"bg-muted/70 dark:bg-muted/90 border border-border/40 dark:border-border/70",
	off: "hatch-fill text-muted-foreground/50 border border-border/40 dark:border-border/60",
	missed: "border border-dashed border-destructive/60 bg-destructive/5",
	today:
		"bg-accent/15 border-2 border-accent dark:border-accent ring-1 ring-accent/30",
	partial: "bg-accent/35 border border-accent/30",
	full: "bg-accent border border-accent/60 shadow-2xs",
	over: "bg-accent-gradient border border-accent/80 shadow-2xs ring-1 ring-accent/30",
};

/** Month at a glance: one cell per working day, weeks as columns, Mon-Fri as rows. */
export function HoursHeatmap({
	weeks,
	today,
}: {
	weeks: (HeatCell | null)[][];
	today: string;
}) {
	return (
		<div
			className="flex gap-1.5"
			role="img"
			aria-label="Hours logged each working day this month"
		>
			<div
				className="flex flex-col justify-between py-px text-[8px] leading-none text-muted-foreground"
				aria-hidden="true"
			>
				{ROW_LABELS.map((l, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static weekday labels
					<span key={i} className="flex h-4 items-center">
						{l}
					</span>
				))}
			</div>
			<div
				className="grid flex-1 gap-1"
				style={{
					gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
				}}
			>
				{weeks.map((week, c) => (
					<div
						key={week.find(Boolean)?.date ?? c}
						className="flex flex-col gap-1"
					>
						{week.map((cell, r) =>
							cell ? (
								<div
									key={cell.date}
									title={`${cell.date}${cell.hours ? `: ${cell.hours}h` : ""}`}
									style={{ animationDelay: `${220 + c * 50 + r * 15}ms` }}
									className={cn(
										"h-4 rounded-[4px] animate-in fade-in zoom-in-50 duration-300 fill-mode-backwards transition-opacity duration-150 hover:opacity-80 cursor-default",
										STATE_CLASS[cell.state],
										cell.date === today &&
											"outline outline-1 outline-offset-1 outline-accent/80",
									)}
								/>
							) : (
								// biome-ignore lint/suspicious/noArrayIndexKey: empty slot before the 1st
								<div key={`gap-${r}`} className="h-4" />
							),
						)}
					</div>
				))}
			</div>
		</div>
	);
}
