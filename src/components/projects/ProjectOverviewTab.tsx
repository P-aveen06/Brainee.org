"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateDisplay } from "@/lib/date-format";
import type { ProjectAccess } from "@/lib/project-access";
import { StageChecklistSummary } from "./StageChecklistSummary";
import { type Stage, type StageProgress, StageTracker } from "./StageTracker";

interface ProjectOverviewTabProps {
	project: {
		id: string;
		description?: string | null;
		projectType: string;
		priority: string;
		currentStageKey?: string | null;
		startDate?: string | null;
		targetEndDate?: string | null;
		actualEndDate?: string | null;
		engagementModel?: string | null;
		clientProjectName?: string | null;
		contractValue?: number | null;
		currency?: string | null;
	};
	client?: {
		name: string;
	} | null;
	members: Array<{
		id: string;
		userName?: string | null;
		role: string;
		isCurrent?: boolean;
	}>;
	access: ProjectAccess;
	stages?: Stage[];
	progress?: StageProgress[];
	checklistSummary?: {
		totalCount: number;
		completedCount: number;
		requiredCount: number;
		requiredMetCount: number;
		percentComplete: number;
		currentStageName?: string;
	} | null;
	onManageMembers: () => void;
	onStageSuccess?: () => void;
}

export function ProjectOverviewTab({
	project,
	client,
	members,
	access,
	stages,
	progress,
	checklistSummary,
	onManageMembers,
	onStageSuccess,
}: ProjectOverviewTabProps) {
	const currentMembers = members.filter((m) => m.isCurrent);

	return (
		<div className="space-y-6">
			{/* Lifecycle Stage Tracker scoped strictly to Overview */}
			{stages && stages.length > 0 && progress && (
				<StageTracker
					projectId={project.id}
					stages={stages}
					progress={progress}
					currentStageKey={project.currentStageKey}
					canManage={access.canManage}
					onSuccess={onStageSuccess || (() => {})}
				/>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left 2 Cols: Details & Description */}
				<div className="lg:col-span-2 space-y-6">
					{checklistSummary && checklistSummary.totalCount > 0 && (
						<StageChecklistSummary
							totalCount={checklistSummary.totalCount}
							completedCount={checklistSummary.completedCount}
							requiredCount={checklistSummary.requiredCount}
							requiredMetCount={checklistSummary.requiredMetCount}
							percentComplete={checklistSummary.percentComplete}
							currentStageName={checklistSummary.currentStageName}
						/>
					)}

					<div className="space-y-4 rounded-xl border border-border bg-card p-5">
						<h3 className="font-heading text-sm font-semibold text-foreground">
							Project Details & Scope
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							{project.description ||
								"No extensive description provided for this project."}
						</p>

						<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border text-xs">
							<div>
								<span className="text-muted-foreground block">
									Project Type
								</span>
								<span className="font-medium capitalize mt-0.5 block">
									{project.projectType.replace(/_/g, " ")}
								</span>
							</div>
							<div>
								<span className="text-muted-foreground block">Priority</span>
								<span className="font-medium capitalize mt-0.5 block">
									{project.priority}
								</span>
							</div>
							<div>
								<span className="text-muted-foreground block">
									Current Stage
								</span>
								<span className="font-medium capitalize mt-0.5 block">
									{project.currentStageKey || "Planning"}
								</span>
							</div>
							<div>
								<span className="text-muted-foreground block">Start Date</span>
								<span className="font-medium mt-0.5 block">
									{project.startDate
										? formatDateDisplay(project.startDate)
										: "—"}
								</span>
							</div>
							<div>
								<span className="text-muted-foreground block">
									Target Completion
								</span>
								<span className="font-medium mt-0.5 block">
									{project.targetEndDate
										? formatDateDisplay(project.targetEndDate)
										: "—"}
								</span>
							</div>
							<div>
								<span className="text-muted-foreground block">
									Actual Completion
								</span>
								<span className="font-medium mt-0.5 block">
									{project.actualEndDate
										? formatDateDisplay(project.actualEndDate)
										: "In Progress"}
								</span>
							</div>
						</div>
					</div>

					{/* Commercial & Contract Summary */}
					{client && (
						<div className="space-y-3 rounded-xl border border-border bg-card p-5">
							<div className="flex items-center justify-between">
								<h3 className="font-heading text-sm font-semibold text-foreground">
									Client Engagement Summary
								</h3>
								<Badge variant="outline" className="capitalize text-xs">
									{project.engagementModel?.replace(/_/g, " ") || "Client"}
								</Badge>
							</div>
							<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 text-xs">
								<div>
									<span className="text-muted-foreground block">
										Organization
									</span>
									<span className="font-medium mt-0.5 block">
										{client.name}
									</span>
								</div>
								<div>
									<span className="text-muted-foreground block">
										Client Project Ref
									</span>
									<span className="font-medium mt-0.5 block">
										{project.clientProjectName || "—"}
									</span>
								</div>
								<div>
									<span className="text-muted-foreground block">
										Contract Value
									</span>
									<span className="font-medium mt-0.5 block">
										{project.contractValue != null
											? `${project.currency || "INR"} ${project.contractValue.toLocaleString("en-IN")}`
											: "—"}
									</span>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Right 1 Col: Quick Roster & Ownership */}
				<div className="space-y-6">
					<div className="space-y-4 rounded-xl border border-border bg-card p-5">
						<div className="flex items-center justify-between">
							<h3 className="font-heading text-sm font-semibold text-foreground">
								Team ({currentMembers.length})
							</h3>
							<Button
								variant="link"
								size="sm"
								className="text-xs h-auto p-0 text-primary"
								onClick={onManageMembers}
							>
								{access.canManage ? "Manage" : "View All"}
							</Button>
						</div>

						<div className="space-y-3">
							{currentMembers.slice(0, 5).map((member) => (
								<div
									key={member.id}
									className="flex items-center justify-between text-xs"
								>
									<div className="flex items-center gap-2 min-w-0">
										<div className="size-6 rounded-full bg-soft-stone flex items-center justify-center text-[10px] font-semibold">
											{member.userName?.slice(0, 2).toUpperCase() || "U"}
										</div>
										<span className="truncate font-medium text-foreground">
											{member.userName}
										</span>
									</div>
									<span className="capitalize text-[11px] text-muted-foreground">
										{member.role}
									</span>
								</div>
							))}
						</div>
					</div>

					{/* Access notice */}
					<div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-xs text-muted-foreground">
						<p className="font-medium text-foreground">
							Your Role: {access.role.toUpperCase()}
						</p>
						<p className="mt-1">
							{access.canOwn
								? "You have full ownership rights to manage members, stages, and project archive."
								: access.canManage
									? "You have management rights to advance stages and assign team members."
									: access.canContribute
										? "You have contributor rights to create tasks, comments, and daily updates."
										: "You have view-only access to this project."}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
