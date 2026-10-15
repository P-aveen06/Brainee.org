import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Separator } from "#/components/ui/separator";
import type {
	CalendarEvent,
	CalendarEventKind,
} from "#/lib/dashboard-calendar.server";
import { formatLeaveType, getTodayIsoDate } from "#/lib/leave-policy";
import { cn } from "#/lib/utils";
import { CardMascotHost, useIsCardPeeking } from "../PeekingMascot";
import type { BirthdayItem, UpcomingLeaveItem } from "../types";
import { Agenda } from "./Agenda";
import {
	addDays,
	buildMonthGrid,
	groupByDate,
	KIND_STYLE,
	monthLabel,
	shiftMonth,
} from "./calendar-utils";
import { DayCell } from "./DayCell";
import { useMonthEvents } from "./useMonthEvents";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const KINDS = Object.keys(KIND_STYLE) as CalendarEventKind[];

export function CalendarRail({
	initial,
	upcomingLeaves,
	upcomingBirthdays,
}: {
	initial: { month: string; events: CalendarEvent[] };
	upcomingLeaves: UpcomingLeaveItem[];
	upcomingBirthdays: BirthdayItem[];
}) {
	const today = getTodayIsoDate();
	const [month, setMonth] = useState(initial.month);
	const [selected, setSelected] = useState<string | null>(null);
	const [hiddenKinds, setHiddenKinds] = useState<Set<CalendarEventKind>>(
		new Set(),
	);
	const { cache, loading, failed, ensure } = useMonthEvents(initial);

	useEffect(() => {
		void ensure(month);
	}, [month, ensure]);
	// The agenda looks ahead, so warm next month's events too.
	useEffect(() => {
		void ensure(shiftMonth(initial.month, 1));
	}, [initial.month, ensure]);

	const visible = (e: CalendarEvent) => !hiddenKinds.has(e.kind);
	const monthEvents = (cache[month] ?? []).filter(visible);
	const byDate = useMemo(() => groupByDate(monthEvents), [monthEvents]);
	const weeks = useMemo(() => buildMonthGrid(month), [month]);
	const agendaEvents = Object.values(cache).flat().filter(visible);
	const feedEvents: CalendarEvent[] = [
		...upcomingLeaves.map((l) => ({
			date: l.startDate,
			kind: "leave" as const,
			label: `${l.name} · ${formatLeaveType(l.leaveType)}`,
			avatarUrl: l.avatarUrl,
		})),
		...upcomingBirthdays.map((b) => ({
			date: addDays(today, b.daysUntil),
			kind: "birthday" as const,
			label: `${b.name}'s birthday`,
			avatarUrl: b.avatarUrl,
		})),
	].filter(visible);

	function toggleKind(kind: CalendarEventKind) {
		setHiddenKinds((prev) => {
			const next = new Set(prev);
			if (next.has(kind)) next.delete(kind);
			else next.add(kind);
			return next;
		});
	}

	const cardDelay = 0.12;
	const contentDelay = cardDelay + 0.2;
	const isPeeking = useIsCardPeeking("calendar");

	return (
		<m.div
			initial={{ opacity: 0, y: 14, scale: 0.985 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.35, delay: cardDelay, ease: [0.2, 0, 0, 1] }}
			className={cn("relative h-full", isPeeking && "z-20")}
		>
			<CardMascotHost cardId="calendar" />
			<Card className="relative z-10 h-full">
				<m.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{
						duration: 0.38,
						delay: contentDelay,
						ease: [0.2, 0, 0, 1],
					}}
					className="flex h-full flex-col"
				>
					<CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-semibold">
							<CalendarDays className="size-4" aria-hidden="true" />
							{monthLabel(month)}
						</CardTitle>
						<div className="flex items-center gap-0.5">
							{month !== initial.month && (
								<Button
									variant="ghost"
									size="xs"
									onClick={() => setMonth(initial.month)}
								>
									Today
								</Button>
							)}
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label="Previous month"
								onClick={() => setMonth((m) => shiftMonth(m, -1))}
							>
								<ChevronLeft />
							</Button>
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label="Next month"
								onClick={() => setMonth((m) => shiftMonth(m, 1))}
							>
								<ChevronRight />
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-3 min-h-0 flex-1 flex flex-col">
						<div
							className={cn(
								"transition-opacity duration-200",
								loading && "opacity-60",
							)}
						>
							<div className="mb-1 grid grid-cols-7 text-center font-mono text-[10px] text-muted-foreground">
								{WEEKDAYS.map((d, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static weekday header
									<span key={i}>{d}</span>
								))}
							</div>
							<div className="grid grid-cols-7 gap-y-0.5">
								{weeks.flat().map(({ date, inMonth }) => (
									<DayCell
										key={date}
										date={date}
										inMonth={inMonth}
										isToday={date === today}
										isSelected={date === selected}
										events={byDate.get(date) ?? []}
										onSelect={() =>
											setSelected((s) => (s === date ? null : date))
										}
									/>
								))}
							</div>
							{failed && (
								<p className="mt-2 text-[11px] text-destructive">
									Couldn't load this month. Try again.
								</p>
							)}
						</div>
						<ul className="flex flex-wrap gap-1">
							{KINDS.map((k) => (
								<li key={k}>
									<button
										type="button"
										aria-pressed={!hiddenKinds.has(k)}
										onClick={() => toggleKind(k)}
										className={cn(
											"flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] transition-[opacity,background-color] duration-200 ease-standard hover:bg-surface-alt focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
											hiddenKinds.has(k) && "opacity-40",
										)}
									>
										<span
											className={cn("size-1.5 rounded-full", KIND_STYLE[k].dot)}
										/>
										{KIND_STYLE[k].label}
									</button>
								</li>
							))}
						</ul>
						<Separator />
						<Agenda
							today={today}
							selected={selected}
							events={agendaEvents.filter(
								(e) => e.kind !== "leave" && e.kind !== "birthday",
							)}
							extra={feedEvents}
							onClear={() => setSelected(null)}
						/>
					</CardContent>
				</m.div>
			</Card>
		</m.div>
	);
}
