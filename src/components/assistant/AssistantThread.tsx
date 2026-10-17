"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import { PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantEmptyState } from "./AssistantEmptyState";
import { AssistantMessages } from "./AssistantMessages";
import { AssistantSuggestions } from "./AssistantSuggestions";
import { ScopeNotice } from "./ScopeNotice";

interface AssistantThreadProps {
	threadTitle?: string;
	showHeader?: boolean;
	onProposalResolved?: () => void;
	onToggleSidebar?: () => void;
	sidebarOpen?: boolean;
	userRole?: string;
	projectCount?: number;
}

export function AssistantThread({
	threadTitle,
	showHeader = true,
	onProposalResolved,
	onToggleSidebar,
	sidebarOpen = true,
	userRole,
	projectCount,
}: AssistantThreadProps) {
	return (
		<ThreadPrimitive.Root className="flex h-full min-w-0 flex-col bg-background">
			{/* Header Bar */}
			{showHeader && (
				<header className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 bg-transparent px-4">
					<div className="flex items-center gap-2 min-w-0">
						{onToggleSidebar && !sidebarOpen && (
							<Button
								variant="ghost"
								size="icon-xs"
								onClick={onToggleSidebar}
								className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-alt -ml-1 mr-0.5"
								title="Open chats"
							>
								<PanelLeftClose className="size-3.5 rotate-180" />
							</Button>
						)}
						<span className="text-xs font-semibold text-foreground truncate tracking-tight">
							{threadTitle || "Company Brain"}
						</span>
					</div>

					<div className="flex items-center gap-3">
						{userRole && (
							<ScopeNotice userRole={userRole} projectCount={projectCount} />
						)}
					</div>
				</header>
			)}

			{/* Scrollable Message Viewport */}
			<ThreadPrimitive.Viewport className="relative flex-1 flex flex-col overflow-y-auto scrollbar-thin">
				<ThreadPrimitive.Empty>
					<AssistantEmptyState />
				</ThreadPrimitive.Empty>

				<div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-8">
					<AssistantMessages onProposalResolved={onProposalResolved} />
					<AssistantSuggestions />
				</div>
			</ThreadPrimitive.Viewport>

			<AssistantComposer />
		</ThreadPrimitive.Root>
	);
}
