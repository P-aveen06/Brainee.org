"use client";

import { Building2, CalendarOff, Laptop, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { TodayPresence } from "@/lib/detailed-admin-stats.server";

interface CeoPresencePulseProps {
	presence: TodayPresence;
}

export function CeoPresencePulse({ presence }: CeoPresencePulseProps) {
	return (
		<Card className="border-border">
			<CardHeader className="p-4 border-b border-border">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-sm font-semibold flex items-center gap-2">
							<Users className="size-4 text-accent" />
							Today&apos;s Team Presence Pulse
						</CardTitle>
						<CardDescription className="text-xs text-muted-foreground mt-0.5">
							Real-time office occupancy, WFH, and scheduled leave.
						</CardDescription>
					</div>
					<Badge variant="outline" className="text-xs font-mono">
						Total: {presence.total} Headcount
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="p-4">
				<div className="grid gap-4 sm:grid-cols-3">
					{/* In Office */}
					<div className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface-alt/40 p-3">
						<div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
							<Building2 className="size-5" />
						</div>
						<div>
							<div className="text-xl font-bold font-mono text-foreground">
								{presence.inOffice}
							</div>
							<div className="text-xs text-muted-foreground">In Office</div>
						</div>
					</div>

					{/* Remote / WFH */}
					<div className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface-alt/40 p-3">
						<div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
							<Laptop className="size-5" />
						</div>
						<div>
							<div className="text-xl font-bold font-mono text-foreground">
								{presence.wfh}
							</div>
							<div className="text-xs text-muted-foreground">WFH</div>
						</div>
					</div>

					{/* On Leave */}
					<div className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface-alt/40 p-3">
						<div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
							<CalendarOff className="size-5" />
						</div>
						<div>
							<div className="text-xl font-bold font-mono text-foreground">
								{presence.onLeave}
							</div>
							<div className="text-xs text-muted-foreground">On Leave</div>
						</div>
					</div>
				</div>

				{/* Breakdown lists if any remote or leave */}
				{(presence.wfhUsers.length > 0 || presence.onLeaveUsers.length > 0) && (
					<div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap gap-2 text-xs">
						{presence.wfhUsers.map((name) => (
							<Badge
								key={name}
								variant="secondary"
								className="text-[11px] font-normal"
							>
								💻 {name} (WFH)
							</Badge>
						))}
						{presence.onLeaveUsers.map((name) => (
							<Badge
								key={name}
								variant="outline"
								className="text-[11px] font-normal border-amber-500/30 text-amber-600 dark:text-amber-400"
							>
								🏖️ {name} (Leave)
							</Badge>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
