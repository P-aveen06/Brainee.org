"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AssistantPageContext } from "@/lib/ai/page-context";
import type { InitialAssistantMessage } from "./AssistantRuntimeAdapter";
import {
	useAssistantSession,
	useAssistantSessionView,
} from "./AssistantSessions";
import { AssistantThread } from "./AssistantThread";

interface AssistantPaneProps {
	sessionKey?: string;
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

/** Displays a session whose runtime is owned by the authenticated layout. */
export function AssistantPane({
	sessionKey,
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
	const session = useAssistantSession(
		sessionKey || conversationId || "drawer",
		conversationId,
		initialMessages,
		pageContext,
	);
	const notifiedId = useRef<string | undefined>(undefined);
	useEffect(() => {
		const id = session?.conversationId;
		if (id && !conversationId && notifiedId.current !== id) {
			notifiedId.current = id;
			onConversationCreated(id);
		}
	}, [session?.conversationId, conversationId, onConversationCreated]);
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const content = useMemo(
		() => (
			<AssistantThread
				threadTitle={threadTitle}
				showHeader={showHeader}
				onProposalResolved={onProposalResolved}
				onToggleSidebar={onToggleSidebar}
				sidebarOpen={sidebarOpen}
				userRole={userRole}
				projectCount={projectCount}
			/>
		),
		[
			threadTitle,
			showHeader,
			onProposalResolved,
			onToggleSidebar,
			sidebarOpen,
			userRole,
			projectCount,
		],
	);
	useAssistantSessionView(session?.key, container, content);
	return <div ref={setContainer} className="h-full min-w-0" />;
}
