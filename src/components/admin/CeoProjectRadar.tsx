"use client";

import { Link } from "@tanstack/react-router";
import {
	AlertOctagon,
	ArrowUpRight,
	ExternalLink,
	FolderKanban,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	CriticalBlocker,
	ProjectExecutiveSummary,
} from "@/lib/detailed-admin-stats.server";

interface CeoProjectRadarProps {
	projects: ProjectExecutiveSummary[];
	criticalBlockers: CriticalBlocker[];
}

export function CeoProjectRadar({
	projects,
	criticalBlockers,
}: CeoProjectRadarProps) {
	return (
		<div className="space-y-6">
			{/* 1. Critical Escalations Callout (Top Priority for CEO) */}
			{criticalBlockers.length > 0 && (
				<Card className="border-amber-500/30 bg-amber-500/5 shadow-xs dark:border-amber-500/20 dark:bg-amber-950/10">
					<CardHeader className="p-4 pb-2">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
									<AlertOctagon className="size-4" />
								</div>
								<div>
									<CardTitle className="text-sm font-semibold text-foreground">
										Critical Delivery Escalations ({criticalBlockers.length})
									</CardTitle>
									<CardDescription className="text-xs text-muted-foreground">
										Client partner dependencies and rate-limiting issues
										blocking sprint milestones.
									</CardDescription>
								</div>
							</div>
							<Badge
								variant="outline"
								className="border-amber-500/30 text-amber-700 bg-amber-500/10 text-xs font-mono dark:text-amber-300"
							>
								Executive Action Required
							</Badge>
						</div>
					</CardHeader>
					<CardContent className="p-4 pt-2">
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{criticalBlockers.slice(0, 6).map((blocker) => (
								<div
									key={blocker.id}
									className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-3 shadow-2xs transition-all hover:border-border"
								>
									<div className="space-y-1.5">
										<div className="flex items-center justify-between text-xs">
											<span className="font-mono font-semibold text-foreground">
												[{blocker.projectCode}]
											</span>
											<span className="text-[11px] text-muted-foreground">
												{blocker.assigneeName || "Unassigned"}
											</span>
										</div>
										<h4 className="text-xs font-medium text-foreground line-clamp-2">
											{blocker.title}
										</h4>
										{blocker.blockedReason && (
											<p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400 line-clamp-3 bg-amber-500/10 p-2 rounded-lg font-mono">
												{blocker.blockedReason}
											</p>
										)}
									</div>
									<div className="mt-3 flex items-center justify-between pt-2 border-t border-border/60 text-[11px]">
										<span className="text-muted-foreground">
											Due: {blocker.dueDate || "Immediate"}
										</span>
										<Link
											to="/projects/$id"
											params={{ id: blocker.projectCode.toLowerCase() }}
											className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
										>
											Inspect <ArrowUpRight className="size-3" />
										</Link>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* 2. Active Projects & Milestone Health */}
			<Card className="border-border">
				<CardHeader className="p-4 border-b border-border">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<FolderKanban className="size-4 text-accent" />
								Active Engagements & Delivery Health ({projects.length})
							</CardTitle>
							<CardDescription className="text-xs text-muted-foreground mt-0.5">
								Overview of live client contracts, completion target dates, and
								lead ownership.
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Badge variant="outline" className="text-xs font-mono">
								{projects.filter((p) => p.health === "green").length} Healthy ·{" "}
								{projects.filter((p) => p.health !== "green").length} At Risk
							</Badge>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[100px]">Code</TableHead>
								<TableHead>Project & Client</TableHead>
								<TableHead>Health</TableHead>
								<TableHead>Stage</TableHead>
								<TableHead>Target Date</TableHead>
								<TableHead>Delivery Lead</TableHead>
								<TableHead className="text-right">Tasks</TableHead>
								<TableHead className="w-[80px]" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{projects.map((project) => {
								const isGreen = project.health === "green";
								const isAmber = project.health === "amber";

								return (
									<TableRow
										key={project.id}
										className="hover:bg-surface-alt/50"
									>
										<TableCell className="font-mono text-xs font-semibold">
											{project.code}
										</TableCell>
										<TableCell>
											<div className="space-y-0.5">
												<div className="font-medium text-xs text-foreground">
													{project.name}
												</div>
												{project.clientName && (
													<div className="text-[11px] text-muted-foreground font-mono">
														Client: {project.clientName}
													</div>
												)}
											</div>
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className={
													isGreen
														? "border-emerald-500/30 text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"
														: isAmber
															? "border-amber-500/30 text-amber-700 bg-amber-500/10 dark:text-amber-300"
															: "border-rose-500/30 text-rose-700 bg-rose-500/10 dark:text-rose-300"
												}
											>
												<span
													className={`mr-1 size-1.5 rounded-full inline-block ${
														isGreen
															? "bg-emerald-500"
															: isAmber
																? "bg-amber-500"
																: "bg-rose-500"
													}`}
												/>
												{project.health.toUpperCase()}
											</Badge>
										</TableCell>
										<TableCell>
											<span className="font-mono text-xs capitalize text-muted-foreground">
												{project.stageKey || "discovery"}
											</span>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground font-mono">
											{project.targetEndDate || "Ongoing"}
										</TableCell>
										<TableCell className="text-xs text-foreground">
											{project.ownerName || "Unassigned"}
										</TableCell>
										<TableCell className="text-right font-mono text-xs">
											<span className="font-semibold text-foreground">
												{project.openTasks}
											</span>
											<span className="text-muted-foreground">
												{" "}
												/ {project.totalTasks}
											</span>
											{project.blockedTasks > 0 && (
												<span className="ml-1.5 text-amber-600 dark:text-amber-400 font-semibold">
													({project.blockedTasks} blocked)
												</span>
											)}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon-xs"
												render={
													<Link
														to="/projects/$id"
														params={{ id: project.id }}
													/>
												}
												title="Open Project Dashboard"
											>
												<ExternalLink className="size-3.5" />
											</Button>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
