import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import type { CalendarEvent } from "#/lib/dashboard-calendar.server";
import { cn } from "#/lib/utils";
import { KIND_STYLE, relativeDayLabel } from "./calendar-utils";

const UPCOMING_LIMIT = 8;
const UPCOMING_KINDS = new Set(["leave", "birthday", "holiday"]);

function EventRow({ event, when }: { event: CalendarEvent; when?: string }) {
	return (
		<li className="flex items-center gap-2.5">
			{event.avatarUrl !== undefined ? (
				<Avatar className="size-6 shrink-0">
					<AvatarImage src={event.avatarUrl ?? ""} />
					<AvatarFallback className="text-[9px]">
						{event.label.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
			) : (
				<span
					className={cn(
						"ml-2 mr-1 size-2 shrink-0 rounded-full",
						KIND_STYLE[event.kind].dot,
					)}
					aria-hidden="true"
				/>
			)}
			<span className="min-w-0 flex-1 truncate text-xs font-medium">
				{event.label}
			</span>
			{when && (
				<span className="shrink-0 text-[11px] text-muted-foreground">
					{when}
				</span>
			)}
		</li>
	);
}

/**
 * Selected day's events, or what's coming up. Multi-day leave collapses to a
 * single row at its first day so it doesn't flood the list.
 */
export function Agenda({
	today,
	selected,
	events,
	extra,
	onClear,
}: {
	today: string;
	selected: string | null;
	events: CalendarEvent[];
	/** Upcoming leave and birthdays from the dashboard feed; they look further ahead than the loaded months. */
	extra: CalendarEvent[];
	onClear: () => void;
}) {
	if (selected) {
		const day = events.filter((e) => e.date === selected);
		return (
			<section aria-label="Selected day">
				<div className="mb-2 flex items-center justify-between">
					<h3 className="text-xs font-semibold">
						{relativeDayLabel(selected, today)}
					</h3>
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label="Clear selected day"
						onClick={onClear}
					>
						<X />
					</Button>
				</div>
				{day.length === 0 ? (
					<p className="text-xs text-muted-foreground">Nothing scheduled.</p>
				) : (
					<ul className="space-y-2">
						{day.map((e) => (
							<EventRow key={`${e.kind}-${e.label}`} event={e} />
						))}
					</ul>
				)}
			</section>
		);
	}

	const seen = new Set<string>();
	const upcoming = [...events, ...extra]
		.filter((e) => e.date >= today && UPCOMING_KINDS.has(e.kind))
		.sort((a, b) => a.date.localeCompare(b.date))
		.filter((e) => {
			const key = `${e.kind}-${e.label}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.slice(0, UPCOMING_LIMIT);

	return (
		<section aria-label="Upcoming">
			<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
				Coming up
			</h3>
			{upcoming.length === 0 ? (
				<p className="text-xs text-muted-foreground">
					Nothing coming up. Pick a day to see details.
				</p>
			) : (
				<ul className="space-y-2">
					{upcoming.map((e) => (
						<EventRow
							key={`${e.kind}-${e.label}-${e.date}`}
							event={e}
							when={relativeDayLabel(e.date, today)}
						/>
					))}
				</ul>
			)}
		</section>
	);
}
