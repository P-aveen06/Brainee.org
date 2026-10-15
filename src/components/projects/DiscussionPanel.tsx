"use client";

import { MessageSquare } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	createComment,
	deleteComment,
	toggleDecisionFlag,
	togglePinComment,
} from "@/api/project-comments";
import { DataTableToolbar } from "@/components/layout/data-table-layout";
import type { ProjectAccess } from "@/lib/project-access";
import { cn } from "@/lib/utils";
import { CommentComposer } from "./CommentComposer";
import { CommentItem, type CommentItemData } from "./CommentItem";

interface DiscussionPanelProps {
	projectId: string;
	comments: CommentItemData[];
	access: ProjectAccess;
	currentUserId?: string;
	onSuccess: () => void;
}

const FILTER_PILLS = [
	{ value: "all", label: "All Messages" },
	{ value: "decisions", label: "Decisions Only" },
	{ value: "pinned", label: "Pinned" },
];

export function DiscussionPanel({
	projectId,
	comments,
	access,
	currentUserId,
	onSuccess,
}: DiscussionPanelProps) {
	const [filter, setFilter] = useState("all");
	const [, startTransition] = useTransition();

	// Separate top-level comments from replies
	const { topLevel, repliesByParent } = useMemo(() => {
		const top: CommentItemData[] = [];
		const replies = new Map<string, CommentItemData[]>();

		for (const c of comments) {
			if (c.parentId) {
				const existing = replies.get(c.parentId) || [];
				existing.push(c);
				replies.set(c.parentId, existing);
			} else {
				top.push(c);
			}
		}

		return { topLevel: top, repliesByParent: replies };
	}, [comments]);

	const filteredTopLevel = useMemo(() => {
		if (filter === "decisions") {
			return topLevel.filter((c) => c.isDecision);
		}
		if (filter === "pinned") {
			return topLevel.filter((c) => c.isPinned);
		}
		return topLevel;
	}, [topLevel, filter]);

	const handlePostNew = async (body: string, isDecision: boolean) => {
		try {
			const res = await createComment({
				data: {
					projectId,
					body,
					isDecision,
				},
			});

			if ("error" in res && res.error) {
				toast.error(res.error);
			} else {
				toast.success(
					isDecision ? "Decision recorded successfully" : "Update posted",
				);
				onSuccess();
			}
		} catch (_err) {
			toast.error("Failed to post message.");
		}
	};

	const handleReply = async (
		parentId: string,
		body: string,
		isDecision: boolean,
	) => {
		try {
			const res = await createComment({
				data: {
					projectId,
					parentId,
					body,
					isDecision,
				},
			});

			if ("error" in res && res.error) {
				toast.error(res.error);
			} else {
				toast.success("Reply posted");
				onSuccess();
			}
		} catch (_err) {
			toast.error("Failed to reply.");
		}
	};

	const handleToggleDecision = (commentId: string) => {
		startTransition(async () => {
			try {
				const res = await toggleDecisionFlag({
					data: { commentId },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					const isDec = "isDecision" in res ? res.isDecision : false;
					toast.success(isDec ? "Marked as Decision" : "Decision tag removed");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to update decision flag.");
			}
		});
	};

	const handleTogglePin = (commentId: string) => {
		startTransition(async () => {
			try {
				const res = await togglePinComment({
					data: { commentId },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					const isPin = "isPinned" in res ? res.isPinned : false;
					toast.success(isPin ? "Pinned to top" : "Unpinned from top");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to update pin.");
			}
		});
	};

	const handleDelete = (commentId: string) => {
		startTransition(async () => {
			try {
				const res = await deleteComment({
					data: { commentId },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Comment removed");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to delete comment.");
			}
		});
	};

	return (
		<div className="space-y-6">
			{/* Top Composer */}
			{access.canContribute && (
				<div className="space-y-2">
					<h3 className="font-heading text-sm font-semibold text-foreground">
						Post Project Update or Decision
					</h3>
					<CommentComposer
						canRecordDecision={access.canContribute}
						onSubmit={handlePostNew}
					/>
				</div>
			)}

			{/* Standardized Toolbar */}
			<DataTableToolbar>
				<div className="flex items-center gap-2">
					<div className="flex items-center rounded-lg bg-surface-alt p-0.5 border border-border/50">
						{FILTER_PILLS.map((p) => (
							<button
								key={p.value}
								type="button"
								onClick={() => setFilter(p.value)}
								className={cn(
									"rounded-md px-2.5 py-1 text-xs font-medium transition-all",
									filter === p.value
										? "bg-card text-foreground shadow-xs font-semibold"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{p.label}
							</button>
						))}
					</div>
				</div>

				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">
						{filteredTopLevel.length} discussion{" "}
						{filteredTopLevel.length === 1 ? "thread" : "threads"}
					</span>
				</div>
			</DataTableToolbar>

			{/* Threads List */}
			{filteredTopLevel.length === 0 ? (
				<div className="border border-dashed border-border p-12 text-center space-y-3">
					<MessageSquare className="size-9 text-muted-foreground mx-auto stroke-1" />
					<p className="text-sm font-medium text-foreground">
						{filter === "decisions"
							? "No official decisions recorded yet."
							: filter === "pinned"
								? "No pinned messages."
								: "No discussion messages posted yet."}
					</p>
					<p className="text-xs text-muted-foreground">
						Share notes, capture client approvals, or record architectural
						decisions.
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{filteredTopLevel.map((comment) => (
						<CommentItem
							key={comment.id}
							comment={comment}
							replies={repliesByParent.get(comment.id) || []}
							access={access}
							currentUserId={currentUserId}
							onReply={handleReply}
							onToggleDecision={handleToggleDecision}
							onTogglePin={handleTogglePin}
							onDelete={handleDelete}
						/>
					))}
				</div>
			)}
		</div>
	);
}
