import { useEffect, useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";

export interface BarSegment {
	value: number;
	color: string;
	/** Draws the segment as diagonal hatching (used / away). */
	hatched?: boolean;
	label?: string;
}

/** Horizontal stacked bar with interactive segment hover animations & fast tooltips. */
export function StackedBar({
	segments,
	total,
	className,
}: {
	segments: BarSegment[];
	total: number;
	className?: string;
}) {
	const [ready, setReady] = useState(false);
	useEffect(() => {
		const timer = setTimeout(() => setReady(true), 220);
		return () => clearTimeout(timer);
	}, []);

	return (
		<div
			className={cn(
				"relative flex h-5 w-full gap-0.5 rounded-lg bg-muted/70 p-0.5",
				className,
			)}
			role="img"
			aria-label={segments.map((s) => `${s.value} ${s.label ?? ""}`).join(", ")}
		>
			{segments.map((s, i) => {
				const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
				if (s.value <= 0) return null;
				return (
					<Tooltip key={s.label ?? s.color}>
						<TooltipTrigger
							render={
								<div
									className={cn(
										"h-full first:rounded-l-md last:rounded-r-md transition-[width,transform,filter] duration-500 ease-bounce cursor-pointer hover:brightness-115 hover:scale-y-125 hover:z-20 hover:shadow-sm origin-center",
										s.hatched && "hatch-fill",
									)}
									style={{
										width: ready && total ? `${(s.value / total) * 100}%` : 0,
										color: s.color,
										backgroundColor: s.color,
										transitionDelay: `${i * 90}ms`,
									}}
								/>
							}
						/>
						<TooltipContent
							side="top"
							sideOffset={6}
							className="px-2.5 py-1 text-xs"
						>
							<div className="flex items-center gap-1.5 font-medium">
								<span
									className="size-2 rounded-full"
									style={{ backgroundColor: s.color }}
								/>
								<span className="capitalize">{s.label ?? "Segment"}:</span>
								<span className="font-bold font-mono">{s.value}</span>
								<span className="text-[10px] text-muted-foreground">
									({pct}%)
								</span>
							</div>
						</TooltipContent>
					</Tooltip>
				);
			})}
		</div>
	);
}
