"use client";

import {
	CircleAlert,
	CircleCheck,
	LoaderCircle,
	PanelLeftClose,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAiConversation } from "@/api/ai-assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AssistantSessionStatus } from "./AssistantSessions";

interface ConversationItem {
	id: string;
	title: string | null;
	lastMessageAt?: Date | null;
	updatedAt?: Date | null;
}

interface ConversationListProps {
	conversations: ConversationItem[];
	activeId?: string;
	statuses?: Record<string, AssistantSessionStatus>;
	onSelect: (id: string) => void;
	onNewChat: () => void;
	onDeleted?: (id: string) => void;
	onCloseSidebar?: () => void;
}

export function ConversationList({
	conversations,
	activeId,
	statuses = {},
	onSelect,
	onNewChat,
	onDeleted,
	onCloseSidebar,
}: ConversationListProps) {
	const [search, setSearch] = useState("");
	const [isDeleting, startTransition] = useTransition();

	const handleDelete = (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		if (!confirm("Are you sure you want to delete this conversation thread?"))
			return;

		startTransition(async () => {
			try {
				await deleteAiConversation({ data: { conversationId: id } });
				toast.success("Thread deleted.");
				onDeleted?.(id);
			} catch (err: unknown) {
				toast.error(
					err instanceof Error ? err.message : "Failed to delete thread.",
				);
			}
		});
	};

	const filtered = conversations.filter((c) =>
		(c.title || "Untitled").toLowerCase().includes(search.toLowerCase()),
	);

	const formatDate = (date?: Date | null) => {
		if (!date) return "";
		const d = new Date(date);
		const now = new Date();
		const diffHours = Math.round((now.getTime() - d.getTime()) / 3600000);
		if (diffHours < 1) return "Just now";
		if (diffHours < 24) return `${diffHours}h ago`;
		return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};

	return (
		<aside className="flex h-full w-full shrink-0 flex-col bg-transparent">
			{/* Top action bar */}
			<div className="p-3 space-y-2.5">
				<div className="flex items-center gap-1.5">
					<Button
						onClick={onNewChat}
						className="h-9 flex-1 justify-center gap-1.5 text-sm font-medium rounded-xl"
					>
						<Plus className="w-3.5 h-3.5" />
						New chat
					</Button>
					{onCloseSidebar && (
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={onCloseSidebar}
							className="size-8.5 shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-alt"
							title="Hide Sidebar"
						>
							<PanelLeftClose className="size-4" />
						</Button>
					)}
				</div>

				<div className="relative">
					<Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search chats..."
						className="h-9 bg-card pl-8 pr-2 text-sm rounded-xl border-border/80"
					/>
				</div>
			</div>

			{/* Recent Chats Heading */}
			<div className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground/70 tracking-tight">
				Recent chats
			</div>

			{/* Conversation items list */}
			<div className="flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-2 scrollbar-thin">
				{filtered.length === 0 ? (
					<div className="p-6 text-center text-sm text-muted-foreground">
						No chats yet
					</div>
				) : (
					filtered.map((conv) => {
						const isActive = conv.id === activeId;
						const timeStr = formatDate(conv.lastMessageAt || conv.updatedAt);
						const status = statuses[conv.id];

						return (
							<div
								key={conv.id}
								className={`group relative flex items-center justify-between gap-1.5 min-h-10 rounded-lg px-2.5 py-2 text-sm transition-colors ${
									isActive
										? "bg-surface-alt text-foreground font-medium"
										: "text-muted-foreground hover:bg-surface hover:text-foreground"
								}`}
							>
								{isActive && (
									<div className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-accent" />
								)}

								<button
									type="button"
									onClick={() => onSelect(conv.id)}
									className="flex items-center min-w-0 flex-1 text-left gap-2"
								>
									<span className="truncate font-sans font-medium text-foreground flex-1">
										{conv.title || "Untitled Chat"}
									</span>
									{status ? (
										<span
											className={`inline-flex shrink-0 items-center gap-1 text-xs ${status === "running" ? "text-accent" : status === "complete" ? "text-success" : "text-destructive"}`}
											title={
												status === "running"
													? "Response in progress"
													: status === "complete"
														? "Response complete"
														: "Response stopped or failed"
											}
										>
											{status === "running" ? (
												<LoaderCircle
													className="size-3.5 animate-spin motion-reduce:animate-none"
													aria-hidden="true"
												/>
											) : status === "complete" ? (
												<CircleCheck className="size-3.5" aria-hidden="true" />
											) : (
												<CircleAlert className="size-3.5" aria-hidden="true" />
											)}
											{status === "running"
												? "Running"
												: status === "complete"
													? "Ready"
													: "Stopped"}
										</span>
									) : (
										timeStr && (
											<span className="shrink-0 text-xs text-muted-foreground/70 font-mono transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
												{timeStr}
											</span>
										)
									)}
								</button>

								<button
									type="button"
									onClick={(e) => handleDelete(e, conv.id)}
									disabled={isDeleting}
									className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 transition-[opacity,color,background-color] hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
									title="Delete Thread"
								>
									<Trash2 className="w-3 h-3" />
								</button>
							</div>
						);
					})
				)}
			</div>
		</aside>
	);
}
