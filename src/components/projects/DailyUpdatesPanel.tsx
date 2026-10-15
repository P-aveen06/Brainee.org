"use client";

import {
	AlertTriangle,
	Calendar,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	Edit,
	Plus,
} from "lucide-react";
import { useState } from "react";
import { DataTableToolbar } from "@/components/layout/data-table-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addIsoDays } from "@/lib/leave-policy";
import type { ProjectAccess } from "@/lib/project-access";
import { DailyUpdateDialog } from "./DailyUpdateDialog";

export interface MemberDailyUpdateData {
	id: string;
	projectId: string;
	userId: string;
	userName: string;
	userEmail: string;
	userAvatarUrl: string | null;
	date: string;
	summary: string;
	blockers: string | null;
	hoursSpent: number | null;
	status: string;
	submittedAt: Date | null;
	createdAt: Date | null;
	items: Array<{
		id: string;
		taskId: string;
		taskNumber: number;
		taskTitle: string;
		note: string | null;
		progressNote: string | null;
	}>;
}

interface DailyUpdatesPanelProps {
	projectId: string;
	projectCode: string;
	projectName: string;
	updates: MemberDailyUpdateData[];
	currentUserId?: string;
	selectedDate: string;
	today: string;
	onDateChange: (date: string) => void;
	access: ProjectAccess;
	onSuccess: () => void;
}

export function DailyUpdatesPanel({
	projectId,
	projectCode,
	projectName,
	updates,
	currentUserId,
	selectedDate,
	today,
	onDateChange,
	access,
	onSuccess,
}: DailyUpdatesPanelProps) {
	const [dialogOpen, setDialogOpen] = useState(false);

	const myUpdate = updates.find((u) => u.userId === currentUserId);

	const handlePrevDay = () => {
		onDateChange(addIsoDays(selectedDate, -1));
	};

	const handleNextDay = () => {
		onDateChange(addIsoDays(selectedDate, 1));
	};

	return (
		<div className="space-y-4">
			{/* Standardized Toolbar */}
			<DataTableToolbar>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon-xs"
						onClick={handlePrevDay}
						className="size-8"
						title="Previous Day"
					>
						<ChevronLeft className="size-4" />
					</Button>
					<Button
						variant={selectedDate === today ? "secondary" : "outline"}
						size="sm"
						onClick={() => onDateChange(today)}
						className="h-8 text-xs font-mono"
					>
						{selectedDate === today ? `Today (${selectedDate})` : selectedDate}
					</Button>
					<Button
						variant="outline"
						size="icon-xs"
						onClick={handleNextDay}
						className="size-8"
						title="Next Day"
					>
						<ChevronRight className="size-4" />
					</Button>
					<span className="text-xs text-muted-foreground ml-2">
						{updates.length} logged
					</span>
				</div>

				<div className="flex items-center gap-2">
					{access.canContribute && (
						<Button
							size="sm"
							onClick={() => setDialogOpen(true)}
							className="h-8 text-xs gap-1.5"
						>
							{myUpdate ? (
								<>
									<Edit className="size-3.5" />
									Edit My Update
								</>
							) : (
								<>
									<Plus className="size-3.5" />
									Log Daily Update
								</>
							)}
						</Button>
					)}
				</div>
			</DataTableToolbar>

			{/* Updates List */}
			{updates.length === 0 ? (
				<div className="border border-border/80 bg-card p-12 text-center space-y-2">
					<Calendar className="size-8 mx-auto text-muted-foreground/50" />
					<h4 className="text-sm font-semibold text-foreground">
						No updates logged for {selectedDate}
					</h4>
					<p className="text-xs text-muted-foreground max-w-sm mx-auto">
						No team members have logged their daily update for this date yet.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{updates.map((update) => {
						const isMe = update.userId === currentUserId;
						return (
							<div
								key={update.id}
								className={`border bg-card p-4 space-y-3 ${
									isMe ? "border-primary/40" : "border-border"
								}`}
							>
								{/* Author & Header */}
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<Avatar className="size-7">
											<AvatarImage
												src={update.userAvatarUrl || undefined}
												alt={update.userName}
											/>
											<AvatarFallback className="text-[10px]">
												{update.userName.slice(0, 2).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<div>
											<div className="flex items-center gap-1.5">
												<span className="text-xs font-semibold text-foreground">
													{update.userName}
												</span>
												{isMe && (
													<Badge
														variant="outline"
														className="text-[9px] py-0 px-1 font-normal text-primary"
													>
														You
													</Badge>
												)}
											</div>
											<span className="text-[10px] text-muted-foreground">
												{update.userEmail}
											</span>
										</div>
									</div>

									<div className="flex items-center gap-2">
										{update.hoursSpent != null && (
											<span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
												<Clock className="size-3" />
												{update.hoursSpent}h
											</span>
										)}
										<Badge
											variant={
												update.status === "submitted" ? "default" : "secondary"
											}
											className="text-[10px] capitalize"
										>
											{update.status === "submitted" ? (
												<CheckCircle2 className="mr-1 size-3" />
											) : null}
											{update.status}
										</Badge>
									</div>
								</div>

								{/* Summary */}
								<p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
									{update.summary}
								</p>

								{/* Linked Tasks */}
								{update.items && update.items.length > 0 && (
									<div className="space-y-1 pt-1 border-t border-border/40">
										<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
											Backlog Items Worked ({update.items.length})
										</span>
										<div className="space-y-1">
											{update.items.map((it) => (
												<div
													key={it.id}
													className="text-xs flex items-baseline gap-1.5 text-muted-foreground"
												>
													<span className="font-mono text-primary font-semibold shrink-0">
														#{it.taskNumber}
													</span>
													<span className="text-foreground font-medium">
														{it.taskTitle}
													</span>
													{(it.note || it.progressNote) && (
														<span className="text-[11px] text-muted-foreground">
															— {it.note || it.progressNote}
														</span>
													)}
												</div>
											))}
										</div>
									</div>
								)}

								{/* Blockers Callout */}
								{update.blockers && (
									<div className="border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive flex items-start gap-2">
										<AlertTriangle className="size-4 shrink-0 mt-0.5" />
										<div>
											<span className="font-semibold block text-[11px]">
												Reported Blocker:
											</span>
											<span className="text-foreground/90">
												{update.blockers}
											</span>
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			<DailyUpdateDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				projectId={projectId}
				projectCode={projectCode}
				projectName={projectName}
				date={selectedDate}
				onSuccess={onSuccess}
			/>
		</div>
	);
}
