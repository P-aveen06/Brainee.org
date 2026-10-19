import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { getAiConversation, getAiConversations } from "@/api/ai-assistant";
import { getProjectsPageData } from "@/api/projects";
import { AssistantPane } from "@/components/assistant/AssistantPane";
import type { InitialAssistantMessage } from "@/components/assistant/AssistantRuntimeAdapter";
import { useAssistantSessionHistory } from "@/components/assistant/AssistantSessions";
import { ConversationList } from "@/components/assistant/ConversationList";
import type { ProposedActionItem } from "@/components/assistant/ProposedActionCard";
import { deriveAssistantPageContext } from "@/lib/ai/page-context";

const assistantSearchSchema = z.object({
	thread: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/assistant")({
	validateSearch: (search) => assistantSearchSchema.parse(search),
	// Keep thread selection in the mounted chat instead of creating a pending route
	// match that can replace the whole page with the app-wide pending skeleton.
	pendingMs: Infinity,
	loader: async ({ context }) => {
		const [convsRes, pageData] = await Promise.all([
			getAiConversations(),
			getProjectsPageData(),
		]);

		const conversations =
			"conversations" in convsRes ? convsRes.conversations : [];

		return {
			conversations,
			projectCount: "projects" in pageData ? pageData.projects.length : 0,
			userRole: context.user.role,
		};
	},
	component: AssistantRoute,
});

function AssistantRoute() {
	const data = Route.useLoaderData();
	const { thread: requestedThread } = Route.useSearch();
	const activeId =
		requestedThread && !requestedThread.startsWith("new")
			? requestedThread
			: undefined;
	const navigate = useNavigate();
	const router = useRouter();
	const liveHistory = useAssistantSessionHistory();
	const hasActiveSession = activeId
		? liveHistory.conversations.some((conversation) => conversation.id === activeId)
		: false;
	const [loadedConversation, setLoadedConversation] = useState<{
		id: string;
		messages: InitialAssistantMessage[];
	}>();
	const conversations = [
		...liveHistory.conversations.filter(
			(live) => !data.conversations.some((saved) => saved.id === live.id),
		),
		...data.conversations,
	];

	const activeThread = conversations.find((c) => c.id === activeId);
	const activeMessages =
		activeId && loadedConversation?.id === activeId
			? loadedConversation.messages
			: EMPTY_MESSAGES;
	const conversationReady =
		!activeId || hasActiveSession || loadedConversation?.id === activeId;

	useEffect(() => {
		if (!activeId || hasActiveSession) return;
		let cancelled = false;

		void getAiConversation({ data: { conversationId: activeId } })
			.then((conversation) => {
				if (cancelled) return;
				const messages: InitialAssistantMessage[] =
					conversation && "messages" in conversation
						? (conversation.messages || []).map((message) => ({
								id: message.id,
								role: message.role as "user" | "assistant",
								content: message.content,
								citations: message.citations,
								charts: message.charts,
								questions: message.questions,
								proposals: message.proposals?.map(
									(proposal): ProposedActionItem => ({
										...proposal,
										payload: parseProposalPayload(proposal.payload),
										status: proposal.status as ProposedActionItem["status"],
									}),
								),
								modelId: message.modelId,
								latencyMs: message.latencyMs,
								createdAt: message.createdAt,
							}))
						: [];
				setLoadedConversation({ id: activeId, messages });
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				setLoadedConversation({ id: activeId, messages: [] });
				toast.error(
					error instanceof Error ? error.message : "Failed to load conversation.",
				);
			});

		return () => {
			cancelled = true;
		};
	}, [activeId, hasActiveSession]);

	// Once the chat is opened, Ready status should disappear
	useEffect(() => {
		if (activeId && liveHistory.statuses[activeId] === "complete") {
			liveHistory.clearStatus(activeId);
		}
	}, [activeId, liveHistory.statuses, liveHistory.clearStatus]);

	const goToThread = (threadId: string | undefined) => {
		if (threadId) {
			liveHistory.clearStatus(threadId);
		}
		navigate({
			to: "/assistant",
			search: threadId ? { thread: threadId } : {},
		});
	};

	const handleNewChat = () =>
		navigate({
			to: "/assistant",
			search: { thread: `new-${Date.now()}` },
		});

	const handleDeleted = (deletedId: string) => {
		liveHistory.forgetConversation(deletedId);
		if (deletedId === activeId) {
			handleNewChat();
		} else {
			router.invalidate();
		}
	};

	const handleConversationCreated = (conversationId: string) => {
		if (
			router.latestLocation.pathname !== "/assistant" ||
			router.latestLocation.search.thread !== requestedThread
		)
			return;
		navigate({
			to: "/assistant",
			search: { thread: conversationId },
			replace: true,
		});
	};

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [draftKey] = useState(() => `new-${Date.now()}`);

	return (
		<div className="relative flex h-full w-full min-w-0 overflow-hidden bg-background">
			{/* Floating History Sidebar on the Left End */}
			<div
				className={`relative z-20 flex h-full shrink-0 flex-col border-r border-border/80 bg-card/95 backdrop-blur-md transition-all duration-300 ease-in-out ${
					sidebarOpen
						? "w-64"
						: "w-0 -translate-x-full overflow-hidden border-r-0"
				}`}
			>
				<ConversationList
					conversations={conversations}
					statuses={liveHistory.statuses}
					activeId={activeId}
					onSelect={goToThread}
					onNewChat={handleNewChat}
					onDeleted={handleDeleted}
					onClearStatus={liveHistory.clearStatus}
					onCloseSidebar={() => setSidebarOpen(false)}
				/>
			</div>

			{/* Main Full-Page Chat Area */}
			<main className="relative flex flex-1 flex-col h-full min-w-0 bg-background overflow-hidden">
				{conversationReady ? (
					<AssistantPane
						key={activeId || requestedThread || "new"}
						sessionKey={activeId || requestedThread || draftKey}
						conversationId={activeId}
						initialMessages={activeMessages}
						threadTitle={activeThread?.title || undefined}
						showHeader={true}
						onConversationCreated={handleConversationCreated}
						onProposalResolved={() => router.invalidate()}
						pageContext={deriveAssistantPageContext("/assistant")}
						onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
						sidebarOpen={sidebarOpen}
						userRole={data.userRole}
						projectCount={data.projectCount}
					/>
				) : (
					<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
						<LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
						Loading conversation…
					</div>
				)}
			</main>
		</div>
	);
}

const EMPTY_MESSAGES: InitialAssistantMessage[] = [];

function parseProposalPayload(payload: unknown): Record<string, unknown> {
	if (typeof payload !== "string") {
		return (payload as Record<string, unknown>) ?? {};
	}
	try {
		return JSON.parse(payload);
	} catch {
		return {};
	}
}
