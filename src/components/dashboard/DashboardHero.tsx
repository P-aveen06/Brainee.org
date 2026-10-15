import { SlidersHorizontal } from "lucide-react";
import { m } from "motion/react";
import { RequestActions } from "#/components/calendar/RequestActions";
import {
	CardMascotHost,
	useIsCardPeeking,
} from "#/components/dashboard/PeekingMascot";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { cn } from "#/lib/utils";
import { HeroQuickLog } from "./HeroQuickLog";

export function DashboardHero({
	firstName,
	summary,
	standardHours,
	existingLog,
	onChanged,
	editing,
	onCustomize,
}: {
	firstName: string;
	summary: string;
	standardHours: number;
	existingLog: { id: string; hours: number } | null;
	onChanged: () => void;
	editing: boolean;
	onCustomize: () => void;
}) {
	const dateLabel = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	const isPeeking = useIsCardPeeking("hero");

	return (
		<m.div
			initial={{ opacity: 0, y: 14, scale: 0.985 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.35, delay: 0, ease: [0.2, 0, 0, 1] }}
			className={cn("relative", isPeeking && "z-20")}
		>
			<CardMascotHost cardId="hero" />
			<Card variant="elevated" className="relative z-10 p-3.5 sm:p-4">
				<m.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.38, delay: 0.18, ease: [0.2, 0, 0, 1] }}
					className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
				>
					<div className="min-w-0">
						<p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
							{dateLabel}
						</p>
						<h1 className="mt-1 font-heading text-2xl font-bold tracking-[-0.04em]">
							Welcome back, {firstName}
						</h1>
						<p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
							{summary}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<HeroQuickLog
							standardHours={standardHours}
							existingLog={existingLog}
							onChanged={onChanged}
						/>
						<RequestActions />
						<Button
							variant={editing ? "default" : "outline"}
							size="icon"
							aria-pressed={editing}
							aria-label="Customize dashboard"
							onClick={onCustomize}
						>
							<SlidersHorizontal />
						</Button>
					</div>
				</m.div>
			</Card>
		</m.div>
	);
}
