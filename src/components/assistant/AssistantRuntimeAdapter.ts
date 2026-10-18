import { type ChatModelAdapter, useLocalRuntime } from "@assistant-ui/react";
import { toast } from "sonner";
import { sendAiMessage } from "@/api/ai-assistant";
import {
	type AssistantActivity,
	type AssistantToolProgress,
	isAssistantActivity,
	isAssistantToolProgress,
} from "@/lib/ai/assistant-activity";
import {
	type AssistantQuestionSet,
	parseAssistantQuestionSet,
} from "@/lib/ai/assistant-questions";
import type { AssistantChartSpec } from "@/lib/ai/chart-types";
import { isAssistantChartSpec } from "@/lib/ai/chart-types";
import type { CitationRef } from "@/lib/ai/citations";
import { CLIENT_TIMEOUT_MS } from "@/lib/ai/completion-timeout";
import type { AssistantPageContext } from "@/lib/ai/page-context";
import { type PitchPackage, parsePitch } from "@/lib/ai/pitch-types";
import type { ProposedActionItem } from "./ProposedActionCard";

/** Shape stored on a message's own `metadata.custom` — see MessageCustomData below for why. */
export interface MessageCustomData {
	citations: CitationRef[];
	proposals: ProposedActionItem[];
	charts: AssistantChartSpec[];
	modelId?: string;
	latencyMs?: number;
	activity?: AssistantActivity;
	toolSteps?: AssistantToolProgress[];
	questions?: AssistantQuestionSet[];
	pitches?: PitchPackage[];
}

export interface InitialAssistantMessage {
	id: string;
	role: "user" | "assistant";
	content: string | null;
	citations?: CitationRef[];
	proposals?: ProposedActionItem[];
	charts?: AssistantChartSpec[];
	questions?: AssistantQuestionSet[];
	pitches?: PitchPackage[];
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
		async *run({ messages, abortSignal }) {
			const lastMessage = messages[messages.length - 1];
			let userText = "";

			for (const part of lastMessage?.content || []) {
				if (part.type === "text") {
					userText += part.text;
				}
			}

			if (!userText.trim()) {
				yield { content: [{ type: "text", text: "" }] };
				return;
			}
			yield { metadata: { custom: { activity: "preparing" } } };
			let currentActivity: AssistantActivity = "preparing";
			const toolSteps: AssistantToolProgress[] = [];
			const updateToolProgress = (value: unknown) => {
				if (!isAssistantToolProgress(value)) return false;
				const safeProgress: AssistantToolProgress = {
					step: value.step,
					status: value.status,
				};
				const existingIndex = toolSteps.findIndex(
					(item) => item.step === safeProgress.step,
				);
				if (existingIndex === -1) toolSteps.push(safeProgress);
				else toolSteps[existingIndex] = safeProgress;
				return true;
			};
			const progressMetadata = () => ({
				custom: { activity: currentActivity, toolSteps: [...toolSteps] },
			});

			const requestController = new AbortController();
			let timedOut = false;
			const handleAbort = () => requestController.abort(abortSignal.reason);
			abortSignal.addEventListener("abort", handleAbort, { once: true });
			const timeoutId = setTimeout(() => {
				timedOut = true;
				requestController.abort();
			}, CLIENT_TIMEOUT_MS);
			let accumulatedText = "";

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
					yield {
						content: [
							{
								type: "text",
								text: `⚠️ Error: ${String(res.error)}`,
							},
						],
					};
					return;
				}

				const createdConversationId =
					!conversationId && "conversationId" in res && res.conversationId
						? String(res.conversationId)
						: undefined;

				let result: Record<string, unknown> | undefined;
				let receivedText = false;
				if ("stream" in res && typeof res.stream?.getReader === "function") {
					const reader = res.stream.getReader();
					const decoder = new TextDecoder();
					let buffer = "";
					const cancelReader = () => {
						void reader.cancel(requestController.signal.reason);
					};
					requestController.signal.addEventListener("abort", cancelReader, {
						once: true,
					});
					const processLine = (line: string) => {
						if (!line.trim()) return null;
						return JSON.parse(line) as {
							type?: string;
							activity?: unknown;
							progress?: unknown;
							text?: string;
							result?: Record<string, unknown>;
						};
					};
					try {
						while (true) {
							const { value, done } = await reader.read();
							buffer += decoder.decode(value, { stream: !done });
							const lines = buffer.split("\n");
							buffer = lines.pop() || "";
							for (const line of lines) {
								const event = processLine(line);
								if (
									event?.type === "activity" &&
									isAssistantActivity(event.activity)
								) {
									currentActivity = event.activity;
									yield { metadata: progressMetadata() };
								} else if (
									event?.type === "tool-progress" &&
									updateToolProgress(event.progress)
								) {
									yield { metadata: progressMetadata() };
								} else if (event?.type === "delta" && event.text) {
									receivedText = true;
									accumulatedText += event.text;
									yield {
										content: [{ type: "text", text: accumulatedText }],
									};
								} else if (event?.type === "result") {
									result = event.result;
								}
							}
							if (done) break;
						}
						const event = processLine(buffer);
						if (
							event?.type === "activity" &&
							isAssistantActivity(event.activity)
						) {
							currentActivity = event.activity;
							yield { metadata: progressMetadata() };
						} else if (
							event?.type === "tool-progress" &&
							updateToolProgress(event.progress)
						) {
							yield { metadata: progressMetadata() };
						} else if (event?.type === "result") result = event.result;
						if (event?.type === "delta" && event.text) {
							receivedText = true;
							accumulatedText += event.text;
							yield {
								content: [{ type: "text", text: accumulatedText }],
							};
						}
					} finally {
						requestController.signal.removeEventListener("abort", cancelReader);
						reader.releaseLock();
					}
				} else {
					result = res as Record<string, unknown>;
				}

				if (!result)
					throw new Error("Company Brain ended without a final response.");
				const content =
					typeof result.content === "string" ? result.content.trim() : "";
				if (!receivedText && content) {
					accumulatedText = content;
					yield { content: [{ type: "text", text: accumulatedText }] };
				} else if (result.errorCode && content) {
					accumulatedText += `\n\n${content}`;
					yield { content: [{ type: "text", text: accumulatedText }] };
				}

				const citations = Array.isArray(result.citations)
					? (result.citations as CitationRef[])
					: [];
				const rawProposals = Array.isArray(result.proposedActions)
					? result.proposedActions
					: [];
				const proposals: ProposedActionItem[] = rawProposals.map((p) => ({
					...p,
					payload: parseProposalPayload(p.payload),
					status: (p.status as ProposedActionItem["status"]) || "pending",
				}));
				const latencyMs =
					typeof result.latencyMs === "number" ? result.latencyMs : undefined;
				const modelId =
					typeof result.modelId === "string" ? result.modelId : undefined;
				const charts = Array.isArray(result.charts)
					? result.charts.filter(isAssistantChartSpec)
					: [];
				const questions = Array.isArray(result.questions)
					? result.questions.flatMap((questionSet) => {
							const parsed = parseAssistantQuestionSet(questionSet);
							return parsed ? [parsed] : [];
						})
					: [];
				yield {
					metadata: {
						custom: {
							citations,
							proposals,
							charts,
							questions,
							pitches: Array.isArray(result.pitches)
								? result.pitches.flatMap((item) => {
										const pitch = parsePitch(item);
										return pitch ? [pitch] : [];
									})
								: [],
							modelId,
							latencyMs,
							activity: currentActivity,
							toolSteps: [...toolSteps],
						} satisfies MessageCustomData,
					},
				};
				// Changing the route key before the stream completes unmounts this
				// runtime, which aborts the response.
				if (createdConversationId) {
					setTimeout(() => onConversationCreated?.(createdConversationId), 0);
				}
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
				accumulatedText += `⚠️ ${label}: ${errorMsg}`;
				yield {
					content: [{ type: "text", text: accumulatedText }],
				};
				return;
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
					charts: (m.charts || []).filter(isAssistantChartSpec),
					questions: m.questions || [],
					pitches: m.pitches || [],
					modelId: m.modelId || undefined,
					latencyMs: m.latencyMs || undefined,
				} satisfies MessageCustomData,
			},
		})),
	});

	return { runtime };
}
