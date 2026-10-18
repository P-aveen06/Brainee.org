import { Link } from "@tanstack/react-router";
import { ArrowRight, Briefcase, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatedNumber } from "#/components/motion";
import { DailyUpdateDialog } from "#/components/projects/DailyUpdateDialog";
import { Button } from "#/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import type { DashboardExtras } from "#/lib/dashboard-extras.server";
import { TaskRow } from "../TaskRow";
import type { UpdateProject } from "../types";
import { Tile } from "./Tile";

function UpdatesPanel({
	projects,
	onPost,
}: {
	projects: UpdateProject[];
	onPost: (p: UpdateProject) => void;
}) {
	const pending = projects.filter((p) => !p.hasSubmitted).length;
	const done = projects.length - pending;
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const t = setTimeout(() => setMounted(true), 240);
		return () => clearTimeout(t);
	}, []);

	if (projects.length === 0) {
		return (
			<div className="flex h-full min-h-[180px] flex-col items-center justify-center p-4 text-center">
				<div className="mb-3 flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
					<CheckCircle2 className="size-5" />
				</div>
				<p className="font-heading text-sm font-semibold text-foreground">
					All updates posted
				</p>
				<p className="mt-1 max-w-xs text-xs text-muted-foreground">
					No pending daily updates assigned for today.
				</p>
			</div>
		);
	}

	const pct =
		projects.length > 0 ? Math.round((done / projects.length) * 100) : 0;

	return (
		<>
			<div className="flex items-baseline justify-between gap-2">
				<div className="flex items-baseline gap-1.5">
					<span className="font-heading text-2xl font-bold leading-none tracking-[-0.04em]">
						<AnimatedNumber value={pending} />
					</span>
					<span className="text-xs text-muted-foreground">
						{pending === 0
							? "all updates posted today"
							: `of ${projects.length} to post today`}
					</span>
				</div>
				<span className="font-mono text-xs text-muted-foreground">
					{done}/{projects.length} posted
				</span>
			</div>
			<Tooltip>
				<TooltipTrigger
					render={
						<div className="mt-2 h-2 overflow-hidden rounded-full bg-muted cursor-pointer transition-all duration-150 hover:scale-y-125 hover:ring-2 hover:ring-accent/30">
							<div
								className="h-full rounded-full bg-accent-gradient transition-[width] duration-700 ease-bounce"
								style={{
									width:
										mounted && projects.length
											? `${(done / projects.length) * 100}%`
											: "0%",
								}}
							/>
						</div>
					}
				/>
				<TooltipContent
					side="top"
					sideOffset={6}
					className="text-xs px-2.5 py-1"
				>
					<span className="font-semibold text-foreground">
						{done} of {projects.length} posted
					</span>
					<span className="text-muted-foreground"> ({pct}%)</span>
				</TooltipContent>
			</Tooltip>
			<ul className="mt-3 space-y-2">
				{projects.map((p) => (
					<li key={p.projectId} className="flex items-center gap-3">
						<div className="min-w-0 flex-1">
							<p className="truncate text-[13px] font-medium">
								{p.projectName}
							</p>
							<p className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
								{p.hasSubmitted && (
									<CheckCircle2
										className="size-3 text-emerald-600"
										aria-hidden="true"
									/>
								)}
								{p.projectCode}
								{p.hasSubmitted && p.hoursSpent ? ` · ${p.hoursSpent}h` : ""}
							</p>
						</div>
						<Button
							size="xs"
							variant={p.hasSubmitted ? "outline" : "secondary"}
							className={
								p.hasSubmitted
									? ""
									: "border border-accent/25 bg-accent/5 text-accent hover:bg-accent/10 hover:border-accent/40"
							}
							onClick={() => onPost(p)}
						>
							{p.hasSubmitted ? "Edit" : "Post update"}
						</Button>
					</li>
				))}
			</ul>
			<div className="mt-3 pt-2 text-center border-t border-border/40">
				<Link
					to="/projects"
					className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					View all projects
					<ArrowRight className="size-3" />
				</Link>
			</div>
		</>
	);
}

function TasksPanel({ tasks }: { tasks: DashboardExtras["tasks"] }) {
	const { summary, upcoming } = tasks;
	return (
		<>
			<div className="mb-2 flex items-baseline justify-between gap-2">
				<div className="flex items-baseline gap-1.5">
					<span className="font-heading text-2xl font-bold leading-none tracking-[-0.04em]">
						<AnimatedNumber value={summary.overdue} />
					</span>
					<span className="text-xs text-muted-foreground">
						tasks overdue · {summary.open} open
					</span>
				</div>
				<div className="flex items-center gap-1.5 text-[11px] font-medium">
					{summary.dueToday > 0 && (
						<span className="rounded-md bg-surface-alt px-1.5 py-0.5 text-muted-foreground">
							{summary.dueToday} today
						</span>
					)}
					{summary.inProgress > 0 && (
						<span className="rounded-md bg-surface-alt px-1.5 py-0.5 text-muted-foreground">
							{summary.inProgress} in progress
						</span>
					)}
				</div>
			</div>
			{upcoming.length === 0 ? (
				<div className="flex h-full min-h-[180px] flex-col items-center justify-center p-4 text-center">
					<div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
						<CheckCircle2 className="size-5" />
					</div>
					<p className="font-heading text-sm font-semibold text-foreground">
						No open tasks
					</p>
					<p className="mt-1 max-w-xs text-xs text-muted-foreground">
						You have no open tasks assigned to you right now. Great job!
					</p>
				</div>
			) : (
				<>
					<div>
						{upcoming.slice(0, 6).map((t) => (
							<TaskRow key={t.id} task={t} />
						))}
					</div>
					<div className="mt-3 pt-2 text-center border-t border-border/40">
						<Link
							to="/my-tasks"
							className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							View all tasks
							<ArrowRight className="size-3" />
						</Link>
					</div>
				</>
			)}
		</>
	);
}

import type { WidgetSize } from "#/lib/dashboard-layout";

/** Daily updates and assigned tasks as two tabs of one card. */
export function WorkCard({
	today,
	projects,
	tasks,
	onChanged,
	size = "md",
}: {
	today: string;
	projects: UpdateProject[];
	tasks: DashboardExtras["tasks"];
	onChanged: () => void;
	size?: WidgetSize;
}) {
	const hasUpdates = projects.length > 0;
	const pending = projects.filter((p) => !p.hasSubmitted).length;
	const [tab, setTab] = useState(hasUpdates ? "updates" : "tasks");
	const [active, setActive] = useState<UpdateProject | null>(null);

	const displayedProjects =
		size === "sm" ? projects.slice(0, 3) : projects.slice(0, 6);

	if (size === "lg") {
		return (
			<Tile title="My work" icon={Briefcase}>
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<div className="rounded-xl border border-border/50 bg-surface-alt/30 p-3.5">
						<p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
							Daily Updates
						</p>
						<UpdatesPanel projects={projects.slice(0, 6)} onPost={setActive} />
					</div>
					<div className="rounded-xl border border-border/50 bg-surface-alt/30 p-3.5">
						<p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
							Assigned Tasks
						</p>
						<TasksPanel tasks={tasks} />
					</div>
				</div>
				{active && (
					<DailyUpdateDialog
						open
						onOpenChange={(open) => !open && setActive(null)}
						projectId={active.projectId}
						projectCode={active.projectCode}
						projectName={active.projectName}
						date={today}
						onSuccess={() => {
							setActive(null);
							onChanged();
						}}
					/>
				)}
			</Tile>
		);
	}

	return (
		<Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
			<Tile
				title="My work"
				icon={Briefcase}
				action={
					hasUpdates ? (
						<TabsList className="h-6.5 rounded-lg border border-border/50 bg-surface-alt p-0.5">
							<TabsTrigger
								value="updates"
								className="h-5.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-all hover:text-foreground data-active:bg-card data-active:text-foreground data-active:shadow-xs data-active:font-semibold"
							>
								Updates
								{pending > 0 && (
									<span className="ml-1 rounded-full bg-primary px-1 font-mono text-[9px] leading-tight text-primary-foreground">
										{pending}
									</span>
								)}
							</TabsTrigger>
							<TabsTrigger
								value="tasks"
								className="h-5.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-all hover:text-foreground data-active:bg-card data-active:text-foreground data-active:shadow-xs data-active:font-semibold"
							>
								Tasks
								{tasks.summary.overdue > 0 && (
									<span className="ml-1 rounded-full bg-destructive px-1 font-mono text-[9px] leading-tight text-white">
										{tasks.summary.overdue}
									</span>
								)}
							</TabsTrigger>
						</TabsList>
					) : null
				}
			>
				<TabsContent value="updates" className="mt-0">
					<UpdatesPanel projects={displayedProjects} onPost={setActive} />
				</TabsContent>
				<TabsContent value="tasks" className="mt-0">
					<TasksPanel tasks={tasks} />
				</TabsContent>
				{active && (
					<DailyUpdateDialog
						open
						onOpenChange={(open) => !open && setActive(null)}
						projectId={active.projectId}
						projectCode={active.projectCode}
						projectName={active.projectName}
						date={today}
						onSuccess={() => {
							setActive(null);
							onChanged();
						}}
					/>
				)}
			</Tile>
		</Tabs>
	);
}
