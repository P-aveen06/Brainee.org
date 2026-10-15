"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useRef } from "react";
import type { AssistantPageContext } from "@/lib/ai/page-context";
import {
	type InitialAssistantMessage,
	useAssistantUiBridge,
} from "./AssistantRuntimeAdapter";
import { AssistantThread } from "./AssistantThread";

interface AssistantPaneProps {
	conversationId: string | undefined;
	initialMessages: InitialAssistantMessage[];
	threadTitle?: string;
	showHeader?: boolean;
	onConversationCreated: (conversationId: string) => void;
	onProposalResolved: () => void;
	pageContext?: AssistantPageContext;
	onToggleSidebar?: () => void;
	sidebarOpen?: boolean;
	userRole?: string;
	projectCount?: number;
}

/**
 * Owns one conversation's runtime. The parent must render this with a `key` tied to the
 * conversation id (see the assistant route) — remounting is how the thread actually resets
 * when the user starts a new chat or picks a different one from the sidebar.
 */
export function AssistantPane({
	conversationId,
	initialMessages,
	threadTitle,
	showHeader = true,
	onConversationCreated,
	onProposalResolved,
	pageContext,
	onToggleSidebar,
	sidebarOpen = true,
	userRole,
	projectCount,
}: AssistantPaneProps) {
	const modelIdRef = useRef<string | undefined>("DeepSeek-V4-Flash");

	const bridge = useAssistantUiBridge(
		conversationId,
		initialMessages,
		onConversationCreated,
		pageContext,
		modelIdRef,
	);

	return (
		<AssistantRuntimeProvider runtime={bridge.runtime}>
			<AssistantThread
				threadTitle={threadTitle}
				showHeader={showHeader}
				onProposalResolved={onProposalResolved}
				onToggleSidebar={onToggleSidebar}
				sidebarOpen={sidebarOpen}
				userRole={userRole}
				projectCount={projectCount}
				modelIdRef={modelIdRef}
			/>
		</AssistantRuntimeProvider>
	);
}
