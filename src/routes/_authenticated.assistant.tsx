import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { getAiConversation, getAiConversations } from "@/api/ai-assistant";
import { getProjectsPageData } from "@/api/projects";
import { AssistantPane } from "@/components/assistant/AssistantPane";
import type { InitialAssistantMessage } from "@/components/assistant/AssistantRuntimeAdapter";
import { ConversationList } from "@/components/assistant/ConversationList";
import type { ProposedActionItem } from "@/components/assistant/ProposedActionCard";
import { deriveAssistantPageContext } from "@/lib/ai/page-context";

const assistantSearchSchema = z.object({
	thread: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/assistant")({
	validateSearch: (search) => assistantSearchSchema.parse(search),
	loaderDeps: ({ search }) => ({ thread: search.thread }),
	loader: async ({ deps }) => {
		const [convsRes, pageData] = await Promise.all([
			getAiConversations(),
			getProjectsPageData(),
		]);

		const conversations =
			"conversations" in convsRes ? convsRes.conversations : [];

		// Always start on a fresh chat when entering the tab (unless an explicit thread is in URL)
		const isExplicitThread =
			deps.thread && !deps.thread.startsWith("new") ? deps.thread : undefined;
		const activeId = isExplicitThread;

		const activeConv = activeId
			? await getAiConversation({ data: { conversationId: activeId } })
			: null;
		// A malformed payload row must not take down the whole page: the proposal card
		// degrades to an empty payload instead of throwing out of the loader.
		const parsePayload = (payload: unknown): Record<string, unknown> => {
			if (typeof payload !== "string") {
				return (payload as Record<string, unknown>) ?? {};
			}
			try {
				return JSON.parse(payload);
			} catch {
				return {};
			}
		};

		const activeMessages: InitialAssistantMessage[] =
			activeConv && "messages" in activeConv
				? (activeConv.messages || []).map((m) => ({
						id: m.id,
						role: m.role as "user" | "assistant",
						content: m.content,
						citations: m.citations,
						proposals: m.proposals?.map(
							(p): ProposedActionItem => ({
								...p,
								payload: parsePayload(p.payload),
								status: p.status as ProposedActionItem["status"],
							}),
						),
						modelId: m.modelId,
						latencyMs: m.latencyMs,
						createdAt: m.createdAt,
					}))
				: [];

		return {
			conversations,
			activeId,
			activeMessages,
			projectCount: "projects" in pageData ? pageData.projects.length : 0,
			userRole:
				"userRole" in pageData && typeof pageData.userRole === "string"
					? pageData.userRole
					: "user",
		};
	},
	component: AssistantRoute,
});

function AssistantRoute() {
	const data = Route.useLoaderData();
	const { thread: requestedThread } = Route.useSearch();
	const navigate = useNavigate();
	const router = useRouter();

	const activeThread = data.conversations.find((c) => c.id === data.activeId);

	const goToThread = (threadId: string | undefined) => {
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
		if (deletedId === data.activeId) {
			handleNewChat();
		} else {
			router.invalidate();
		}
	};

	const handleConversationCreated = (conversationId: string) => {
		navigate({
			to: "/assistant",
			search: { thread: conversationId },
			replace: true,
		});
	};

	const [sidebarOpen, setSidebarOpen] = useState(true);

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
					conversations={data.conversations}
					activeId={data.activeId}
					onSelect={goToThread}
					onNewChat={handleNewChat}
					onDeleted={handleDeleted}
					onCloseSidebar={() => setSidebarOpen(false)}
				/>
			</div>

			{/* Main Full-Page Chat Area */}
			<main className="relative flex flex-1 flex-col h-full min-w-0 bg-background overflow-hidden">
				<AssistantPane
					key={data.activeId || requestedThread || "new"}
					conversationId={data.activeId}
					initialMessages={data.activeMessages}
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
			</main>
		</div>
	);
}
