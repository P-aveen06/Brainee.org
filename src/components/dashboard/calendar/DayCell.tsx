import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import type { CalendarEvent } from "#/lib/dashboard-calendar.server";
import { cn } from "#/lib/utils";
import { KIND_STYLE } from "./calendar-utils";

const SHOWN = 4;

export function DayCell({
	date,
	inMonth,
	isToday,
	isSelected,
	events,
	onSelect,
}: {
	date: string;
	inMonth: boolean;
	isToday: boolean;
	isSelected: boolean;
	events: CalendarEvent[];
	onSelect: () => void;
}) {
	const kinds = [...new Set(events.map((e) => e.kind))].slice(0, 3);
	const button = (
		<button
			type="button"
			onClick={onSelect}
			aria-label={`${date}, ${events.length} events`}
			className={cn(
				"flex h-9 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition-colors duration-150 ease-out hover:bg-surface-alt focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:h-8",
				!inMonth && "text-muted-foreground/40",
				isSelected &&
					!isToday &&
					"bg-surface-alt ring-1 ring-foreground/30 shadow-xs",
				isToday &&
					"bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
			)}
		>
			{Number(date.slice(8))}
			<span className="flex h-1 gap-0.5">
				{inMonth &&
					kinds.map((k) => (
						<span
							key={k}
							className={cn("size-1 rounded-full", KIND_STYLE[k].dot)}
						/>
					))}
			</span>
		</button>
	);

	if (events.length === 0) return button;

	return (
		<Tooltip>
			<TooltipTrigger render={button} />
			<TooltipContent
				side="top"
				className="max-w-56 flex-col items-start gap-1 py-2"
			>
				<span className="font-semibold">
					{new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
						weekday: "short",
						month: "short",
						day: "numeric",
					})}
				</span>
				{events.slice(0, SHOWN).map((e) => (
					<span
						key={`${e.kind}-${e.label}`}
						className="flex items-center gap-1.5"
					>
						<span
							className={cn(
								"size-1.5 shrink-0 rounded-full",
								KIND_STYLE[e.kind].dot,
							)}
						/>
						<span className="truncate">{e.label}</span>
					</span>
				))}
				{events.length > SHOWN && (
					<span className="opacity-70">+{events.length - SHOWN} more</span>
				)}
			</TooltipContent>
		</Tooltip>
	);
}
