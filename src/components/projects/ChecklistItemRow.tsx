"use client";

import { Calendar, MessageSquare, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateDisplay } from "@/lib/date-format";
import type { ProjectAccess } from "@/lib/project-access";
import { cn } from "@/lib/utils";

export interface ChecklistItemData {
	id: string;
	projectId: string;
	stageKey: string;
	templateId?: string | null;
	title: string;
	description?: string | null;
	isRequired: boolean;
	status: "pending" | "done" | "not_applicable" | string;
	assignedToId?: string | null;
	assignedToName?: string | null;
	assignedToAvatar?: string | null;
	dueDate?: string | null;
	completedById?: string | null;
	completedAt?: Date | null;
	notes?: string | null;
	sequence: number;
}

interface ChecklistItemRowProps {
	item: ChecklistItemData;
	access: ProjectAccess;
	onToggleStatus: (
		item: ChecklistItemData,
		newStatus: "pending" | "done" | "not_applicable",
	) => void;
	onEdit: (item: ChecklistItemData) => void;
	onDelete: (itemId: string) => void;
	isPending: boolean;
}

export function ChecklistItemRow({
	item,
	access,
	onToggleStatus,
	onEdit,
	onDelete,
	isPending,
}: ChecklistItemRowProps) {
	const isDone = item.status === "done";
	const isNA = item.status === "not_applicable";

	return (
		<div
			className={cn(
				"flex items-start justify-between gap-3 p-3.5 border border-border bg-card transition-colors",
				isDone && "bg-muted/20 border-border/70",
				isNA && "opacity-60 bg-muted/30",
			)}
		>
			<div className="flex items-start gap-3 min-w-0">
				<div className="pt-0.5">
					<Checkbox
						id={`check-${item.id}`}
						checked={isDone}
						disabled={!access.canContribute || isPending}
						onCheckedChange={(checked) => {
							onToggleStatus(item, checked ? "done" : "pending");
						}}
					/>
				</div>

				<div className="space-y-1 min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<label
							htmlFor={`check-${item.id}`}
							className={cn(
								"text-xs font-semibold cursor-pointer select-none leading-snug",
								isDone && "line-through text-muted-foreground font-normal",
								isNA && "italic text-muted-foreground",
							)}
						>
							{item.title}
						</label>

						{item.isRequired && (
							<Badge
								variant="outline"
								className={cn(
									"text-[10px] px-1.5 py-0",
									isDone || isNA
										? "text-muted-foreground border-border"
										: "border-destructive/40 text-destructive bg-destructive/5 font-semibold",
								)}
							>
								{isDone ? "Required ✓" : "Required"}
							</Badge>
						)}

						{isNA && (
							<Badge
								variant="outline"
								className="text-[10px] px-1.5 py-0 text-muted-foreground"
							>
								N/A
							</Badge>
						)}
					</div>

					{item.description && (
						<p className="text-[11px] text-muted-foreground leading-relaxed">
							{item.description}
						</p>
					)}

					{/* Metadata row */}
					<div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
						{item.assignedToName && (
							<div className="flex items-center gap-1">
								<Avatar className="size-4">
									<AvatarImage src={item.assignedToAvatar || undefined} />
									<AvatarFallback className="text-[8px]">
										{item.assignedToName.slice(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span>{item.assignedToName}</span>
							</div>
						)}

						{item.dueDate && (
							<div className="flex items-center gap-1">
								<Calendar className="size-3" />
								<span>Due {formatDateDisplay(item.dueDate)}</span>
							</div>
						)}

						{item.notes && (
							<div className="flex items-center gap-1 text-primary/90">
								<MessageSquare className="size-3" />
								<span className="truncate max-w-xs">{item.notes}</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Actions Menu */}
			{access.canContribute && (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="ghost"
								size="icon-xs"
								className="size-7 p-0 -mr-1"
							/>
						}
					>
						<MoreVertical className="size-3.5 text-muted-foreground" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onClick={() => onToggleStatus(item, isDone ? "pending" : "done")}
						>
							{isDone ? "Mark as Pending" : "Mark as Completed"}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								onToggleStatus(item, isNA ? "pending" : "not_applicable")
							}
						>
							{isNA ? "Remove N/A status" : "Mark as Not Applicable"}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => onEdit(item)}>
							Edit Item
						</DropdownMenuItem>
						{access.canManage && (
							<DropdownMenuItem
								variant="destructive"
								onClick={() => onDelete(item.id)}
							>
								Delete Item
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}
