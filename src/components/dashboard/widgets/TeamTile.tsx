import { Users } from "lucide-react";
import { AnimatedNumber } from "#/components/motion";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import type { AvailabilityEntry } from "../types";
import { CHART } from "./chart-colors";
import { StackedBar } from "./StackedBar";
import { Tile } from "./Tile";

const SHOWN = 4;

import type { WidgetSize } from "#/lib/dashboard-layout";

/** Who's in the office, on WFH or on leave today, and who exactly is away. */
export function TeamTile({
	teamSize,
	availability,
	size = "sm",
}: {
	teamSize: number;
	availability: AvailabilityEntry[];
	size?: WidgetSize;
}) {
	const wfh = availability.filter((a) => a.statusText === "WFH").length;
	const leave = availability.length - wfh;
	const inOffice = Math.max(teamSize - wfh - leave, 0);
	const pctInOffice =
		teamSize > 0 ? Math.round((inOffice / teamSize) * 100) : 0;
	const legend = [
		{ label: "In office", value: inOffice, color: CHART.ink },
		{ label: "WFH", value: wfh, color: CHART.wfh },
		{ label: "On leave", value: leave, color: CHART.leave },
	];

	if (size === "lg") {
		const wfhList = availability.filter((a) => a.statusText === "WFH");
		const leaveList = availability.filter((a) => a.statusText !== "WFH");

		return (
			<Tile title="Team today" icon={Users}>
				<div className="grid h-full grid-cols-1 items-center gap-6 lg:grid-cols-[220px_1fr]">
					<div className="space-y-3">
						<div className="flex items-baseline gap-1.5">
							<span className="font-heading text-3xl font-bold leading-none tracking-[-0.04em]">
								<AnimatedNumber value={inOffice} />
							</span>
							<span className="text-sm text-muted-foreground">
								of {teamSize} in office
							</span>
						</div>
						<StackedBar
							className="mt-2"
							total={teamSize}
							segments={[
								{ value: inOffice, color: CHART.ink, label: "in office" },
								{ value: wfh, color: CHART.wfh, label: "WFH" },
								{
									value: leave,
									color: CHART.leave,
									label: "on leave",
								},
							]}
						/>
						<div className="flex gap-3 text-xs text-muted-foreground">
							<span>
								In office:{" "}
								<strong className="text-foreground">{inOffice}</strong>
							</span>
							<span>
								WFH: <strong className="text-foreground">{wfh}</strong>
							</span>
							<span>
								Leave: <strong className="text-foreground">{leave}</strong>
							</span>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="rounded-xl border border-border/60 bg-surface-alt/40 p-3">
							<p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
								WFH Today ({wfh})
							</p>
							{wfhList.length === 0 ? (
								<p className="mt-2 text-xs text-muted-foreground">
									No one on WFH today
								</p>
							) : (
								<ul className="mt-2 space-y-1.5">
									{wfhList.map((a) => (
										<li key={a.name} className="flex items-center gap-2">
											<Avatar className="size-5">
												<AvatarImage src={a.avatarUrl ?? ""} />
												<AvatarFallback className="text-[9px]">
													{a.name.slice(0, 2)}
												</AvatarFallback>
											</Avatar>
											<span className="truncate text-xs font-medium text-foreground">
												{a.name}
											</span>
										</li>
									))}
								</ul>
							)}
						</div>

						<div className="rounded-xl border border-border/60 bg-surface-alt/40 p-3">
							<p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
								On Leave Today ({leave})
							</p>
							{leaveList.length === 0 ? (
								<p className="mt-2 text-xs text-muted-foreground">
									No one on leave today
								</p>
							) : (
								<ul className="mt-2 space-y-1.5">
									{leaveList.map((a) => (
										<li key={a.name} className="flex items-center gap-2">
											<Avatar className="size-5 ring-1 ring-amber-500/40">
												<AvatarImage src={a.avatarUrl ?? ""} />
												<AvatarFallback className="text-[9px]">
													{a.name.slice(0, 2)}
												</AvatarFallback>
											</Avatar>
											<span className="truncate text-xs font-medium text-foreground">
												{a.name}
											</span>
											<span className="truncate text-[10px] text-muted-foreground">
												{a.statusText.replace("On Leave ", "")}
											</span>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				</div>
			</Tile>
		);
	}

	return (
		<Tile title="Team today" icon={Users}>
			<div className="flex items-baseline justify-between gap-1.5">
				<div className="flex items-baseline gap-1.5">
					<span className="font-heading text-2xl font-bold leading-none tracking-[-0.04em]">
						<AnimatedNumber value={inOffice} />
					</span>
					<span className="text-xs text-muted-foreground">
						of {teamSize} in office
					</span>
				</div>
				{size === "md" && (
					<span className="rounded-md bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
						{pctInOffice}% present
					</span>
				)}
			</div>
			<StackedBar
				className="mt-3"
				total={teamSize}
				segments={[
					{ value: inOffice, color: CHART.ink, label: "in office" },
					{ value: wfh, color: CHART.wfh, label: "WFH" },
					{
						value: leave,
						color: CHART.leave,
						label: "on leave",
					},
				]}
			/>
			<ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
				{legend.map((l) => (
					<li
						key={l.label}
						className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors duration-150 hover:text-foreground cursor-pointer"
					>
						<span
							className="size-2 rounded-full transition-transform duration-150 group-hover:scale-125"
							style={{ backgroundColor: l.color }}
							aria-hidden="true"
						/>
						{l.label}
						<span className="font-mono font-medium text-foreground">
							{l.value}
						</span>
					</li>
				))}
			</ul>
			<div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
				<span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
					Out today
				</span>
				{availability.length > 0 ? (
					<>
						<div className="flex -space-x-2">
							{availability.slice(0, size === "md" ? 6 : SHOWN).map((a, i) => (
								<Tooltip key={`${a.name}-${a.statusText}`}>
									<TooltipTrigger
										render={
											<span
												className="relative inline-flex rounded-full transition-transform hover:z-30 hover:scale-110"
												style={{ zIndex: 10 - i }}
											/>
										}
									>
										<Avatar
											className="size-6 ring-2 ring-offset-2 ring-offset-card"
											style={{
												["--tw-ring-color" as string]:
													a.statusText === "WFH" ? CHART.wfh : CHART.leave,
											}}
										>
											<AvatarImage src={a.avatarUrl ?? ""} />
											<AvatarFallback className="text-[9px]">
												{a.name.slice(0, 2).toUpperCase()}
											</AvatarFallback>
										</Avatar>
									</TooltipTrigger>
									<TooltipContent>
										{a.name} · {a.statusText.replace("On Leave ", "Leave ")}
									</TooltipContent>
								</Tooltip>
							))}
						</div>
						{size === "md" && availability.length > 0 && (
							<span className="truncate text-[11px] text-muted-foreground">
								{availability
									.slice(0, 2)
									.map((a) => a.name.split(" ")[0])
									.join(", ")}
								{availability.length > 2 ? ` +${availability.length - 2}` : ""}
							</span>
						)}
						{size === "sm" && availability.length > SHOWN && (
							<span className="text-[11px] text-muted-foreground">
								+{availability.length - SHOWN}
							</span>
						)}
					</>
				) : (
					<span className="text-xs text-muted-foreground">
						All team members in office today
					</span>
				)}
			</div>
		</Tile>
	);
}
