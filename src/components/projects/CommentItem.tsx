"use client";

import { CheckCircle2, MoreVertical, Pin, Reply } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { CommentComposer } from "./CommentComposer";

export interface CommentItemData {
	id: string;
	projectId: string;
	stageKey?: string | null;
	taskId?: string | null;
	documentId?: string | null;
	parentId?: string | null;
	authorId: string;
	authorName?: string | null;
	authorEmail?: string | null;
	authorAvatarUrl?: string | null;
	body: string;
	isDecision: boolean;
	isPinned: boolean;
	editedAt?: Date | null;
	createdAt?: Date | null;
}

interface CommentItemProps {
	comment: CommentItemData;
	replies?: CommentItemData[];
	access: ProjectAccess;
	currentUserId?: string;
	onReply: (
		parentId: string,
		body: string,
		isDecision: boolean,
	) => Promise<void>;
	onToggleDecision: (commentId: string) => void;
	onTogglePin: (commentId: string) => void;
	onDelete: (commentId: string) => void;
	isReply?: boolean;
}

export function CommentItem({
	comment,
	replies = [],
	access,
	currentUserId,
	onReply,
	onToggleDecision,
	onTogglePin,
	onDelete,
	isReply = false,
}: CommentItemProps) {
	const [replying, setReplying] = useState(false);
	const isAuthor = currentUserId === comment.authorId;

	return (
		<div
			className={cn(
				"space-y-3 p-4 border bg-card transition-colors",
				comment.isPinned && "border-primary/40 bg-primary/5",
				comment.isDecision &&
					"border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10",
				!comment.isPinned && !comment.isDecision && "border-border",
				isReply && "ml-6 border-l-2 border-l-primary/40 p-3 bg-muted/10",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-2.5 min-w-0">
					<Avatar className="size-6">
						<AvatarImage src={comment.authorAvatarUrl || undefined} />
						<AvatarFallback className="text-[10px]">
							{comment.authorName?.slice(0, 2).toUpperCase() || "U"}
						</AvatarFallback>
					</Avatar>

					<div className="min-w-0">
						<span className="text-xs font-semibold text-foreground block truncate">
							{comment.authorName || "Team Member"}
						</span>
						<span className="text-[10px] text-muted-foreground block">
							{comment.createdAt ? formatDateDisplay(comment.createdAt) : "—"}
							{comment.editedAt && " (edited)"}
						</span>
					</div>
				</div>

				<div className="flex items-center gap-1.5">
					{comment.isPinned && (
						<Badge
							variant="default"
							className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30 gap-1"
						>
							<Pin className="size-2.5" /> Pinned
						</Badge>
					)}

					{comment.isDecision && (
						<Badge
							variant="default"
							className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 gap-1 font-semibold"
						>
							<CheckCircle2 className="size-2.5" /> Decision
						</Badge>
					)}

					{access.canContribute && (
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant="ghost"
										size="icon-xs"
										className="size-6 p-0 -mr-1"
									/>
								}
							>
								<MoreVertical className="size-3 text-muted-foreground" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{!isReply && (
									<DropdownMenuItem onClick={() => setReplying(true)}>
										<Reply className="mr-2 size-3.5" /> Reply
									</DropdownMenuItem>
								)}

								<DropdownMenuItem onClick={() => onToggleDecision(comment.id)}>
									<CheckCircle2 className="mr-2 size-3.5 text-amber-500" />
									{comment.isDecision
										? "Remove Decision Tag"
										: "Mark as Decision"}
								</DropdownMenuItem>

								{access.canManage && (
									<DropdownMenuItem onClick={() => onTogglePin(comment.id)}>
										<Pin className="mr-2 size-3.5" />
										{comment.isPinned ? "Unpin Comment" : "Pin to Top"}
									</DropdownMenuItem>
								)}

								{(isAuthor || access.canManage) && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											onClick={() => onDelete(comment.id)}
										>
											Delete Comment
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</div>

			{/* Body text */}
			<div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap pl-8">
				{comment.body}
			</div>

			{/* Inline Reply Trigger */}
			{!isReply && !replying && access.canContribute && (
				<div className="pl-8 pt-1">
					<Button
						variant="ghost"
						size="sm"
						className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground gap-1"
						onClick={() => setReplying(true)}
					>
						<Reply className="size-3" /> Reply
					</Button>
				</div>
			)}

			{/* Inline Reply Composer */}
			{replying && (
				<div className="pl-8 pt-2">
					<CommentComposer
						placeholder={`Reply to ${comment.authorName || "team member"}...`}
						submitLabel="Reply"
						canRecordDecision={access.canManage}
						onSubmit={async (body, isDecision) => {
							await onReply(comment.id, body, isDecision);
							setReplying(false);
						}}
						onCancel={() => setReplying(false)}
					/>
				</div>
			)}

			{/* Nested Replies */}
			{replies.length > 0 && (
				<div className="space-y-2.5 pt-2">
					{replies.map((r) => (
						<CommentItem
							key={r.id}
							comment={r}
							access={access}
							currentUserId={currentUserId}
							onReply={onReply}
							onToggleDecision={onToggleDecision}
							onTogglePin={onTogglePin}
							onDelete={onDelete}
							isReply={true}
						/>
					))}
				</div>
			)}
		</div>
	);
}
