import { type ChatModelAdapter, useLocalRuntime } from "@assistant-ui/react";
import { toast } from "sonner";
import { sendAiMessage } from "@/api/ai-assistant";
import type { CitationRef } from "@/lib/ai/citations";
import { CLIENT_TIMEOUT_MS } from "@/lib/ai/completion-timeout";
import type { AssistantPageContext } from "@/lib/ai/page-context";
import type { ProposedActionItem } from "./ProposedActionCard";

/** Shape stored on a message's own `metadata.custom` — see MessageCustomData below for why. */
export interface MessageCustomData {
	citations: CitationRef[];
	proposals: ProposedActionItem[];
	modelId?: string;
	latencyMs?: number;
}

export interface InitialAssistantMessage {
	id: string;
	role: "user" | "assistant";
	content: string | null;
	citations?: CitationRef[];
	proposals?: ProposedActionItem[];
	modelId?: string | null;
	latencyMs?: number | null;
	createdAt?: string | Date | null;
}

function parseProposalPayload(payload: unknown): Record<string, unknown> {
	if (typeof payload !== "string") {
		return (payload as Record<string, unknown>) || {};
	}
	try {
		return JSON.parse(payload) as Record<string, unknown>;
	} catch {
		return {};
	}
}

/**
 * Drives one conversation's runtime. Callers must remount this hook (e.g. via a `key` on the
 * component that calls it) whenever the active conversation changes — assistant-ui's local
 * runtime owns its own message list internally and has no API to reset or re-seed it in place.
 *
 * Citations and proposed actions are attached directly to each message's own
 * `metadata.custom` (the field assistant-ui provides for exactly this) rather than a
 * side dictionary keyed by message id — the runtime assigns its own ids to messages it
 * renders, which never match the server's id, so a side lookup silently finds nothing.
 */
export function useAssistantUiBridge(
	conversationId: string | undefined,
	initialMessages: InitialAssistantMessage[] = [],
	onConversationCreated?: (conversationId: string) => void,
	pageContext?: AssistantPageContext,
) {
	const adapter: ChatModelAdapter = {
		async run({ messages, abortSignal }) {
			const lastMessage = messages[messages.length - 1];
			let userText = "";

			for (const part of lastMessage?.content || []) {
				if (part.type === "text") {
					userText += part.text;
				}
			}

			if (!userText.trim()) {
				return { content: [{ type: "text", text: "" }] };
			}

			const requestController = new AbortController();
			let timedOut = false;
			const handleAbort = () => requestController.abort(abortSignal.reason);
			abortSignal.addEventListener("abort", handleAbort, { once: true });
			const timeoutId = setTimeout(() => {
				timedOut = true;
				requestController.abort();
			}, CLIENT_TIMEOUT_MS);

			try {
				const res = await sendAiMessage({
					data: {
						conversationId,
						message: userText,
						pageContext,
					},
					signal: requestController.signal,
				});

				if ("error" in res && res.error) {
					toast.error(String(res.error));
					return {
						content: [
							{
								type: "text",
								text: `⚠️ Error: ${String(res.error)}`,
							},
						],
					};
				}

				if (!conversationId && "conversationId" in res && res.conversationId) {
					onConversationCreated?.(String(res.conversationId));
				}

				const citations = (
					"citations" in res ? res.citations : []
				) as CitationRef[];
				const rawProposals =
					"proposedActions" in res && Array.isArray(res.proposedActions)
						? res.proposedActions
						: [];
				const proposals: ProposedActionItem[] = rawProposals.map((p) => ({
					...p,
					payload: parseProposalPayload(p.payload),
					status: (p.status as ProposedActionItem["status"]) || "pending",
				}));
				const latencyMs =
					"latencyMs" in res ? (res.latencyMs as number) : undefined;
				const modelId =
					"modelId" in res && typeof res.modelId === "string"
						? res.modelId
						: undefined;

				return {
					content: [
						{
							type: "text",
							text:
								"content" in res && typeof res.content === "string"
									? res.content.trim()
									: "Request processed.",
						},
					],
					metadata: {
						custom: {
							citations,
							proposals,
							modelId,
							latencyMs,
						} satisfies MessageCustomData,
					},
				};
			} catch (err: unknown) {
				const label = timedOut
					? "Timeout"
					: abortSignal.aborted
						? "Interrupted"
						: "Connection Error";
				const errorMsg = timedOut
					? "Company Brain did not complete within 32 seconds. Please retry; do not assume the requested action was performed."
					: abortSignal.aborted
						? "The response was interrupted before completion."
						: err instanceof Error
							? err.message
							: "Failed to communicate with assistant.";
				toast.error(errorMsg);
				return {
					content: [
						{
							type: "text",
							text: `⚠️ ${label}: ${errorMsg}`,
						},
					],
				};
			} finally {
				clearTimeout(timeoutId);
				abortSignal.removeEventListener("abort", handleAbort);
			}
		},
	};

	const runtime = useLocalRuntime(adapter, {
		initialMessages: initialMessages.map((m) => ({
			id: m.id,
			role: m.role,
			content:
				typeof m.content === "string" ? m.content.trim() : m.content || "",
			createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
			metadata: {
				custom: {
					citations: m.citations || [],
					proposals: m.proposals || [],
					modelId: m.modelId || undefined,
					latencyMs: m.latencyMs || undefined,
				} satisfies MessageCustomData,
			},
		})),
	});

	return { runtime };
}
