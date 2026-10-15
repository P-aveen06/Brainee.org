import type { aiMessages } from "@/db/schema";
import type { ChatMessage } from "./provider";

/** How a 'tool' row's content is stored, so a later turn can re-check access before replay. */
export interface StoredToolPayload {
	scopeProjectId?: string;
	result: unknown;
}

/**
 * Rebuilds the provider-facing message history from stored rows, redacting any prior tool
 * result scoped to a project the caller can no longer see.
 */
export function reconstructHistory(
	historyRows: Array<typeof aiMessages.$inferSelect>,
	canSeeProject: (projectId: string) => boolean,
): ChatMessage[] {
	// A bounded row query can begin halfway through an older multi-hop turn. Drop that
	// incomplete prefix so provider history always begins at a user-message boundary.
	const firstUserIndex = historyRows.findIndex((row) => row.role === "user");
	const completeRows =
		firstUserIndex >= 0 ? historyRows.slice(firstUserIndex) : historyRows;
	return completeRows.map((m) => {
		if (m.role === "tool") {
			let stored: StoredToolPayload = { result: null };
			if (m.content) {
				try {
					stored = JSON.parse(m.content);
				} catch {
					stored = { result: m.content };
				}
			}
			const content =
				stored.scopeProjectId && !canSeeProject(stored.scopeProjectId)
					? JSON.stringify({ error: "That project is no longer accessible." })
					: JSON.stringify(stored.result);
			return {
				role: "tool",
				content: `<tool_data>${content}</tool_data>`,
				toolCallId: m.toolCallId || undefined,
			};
		}
		let parsedToolCalls: ChatMessage["toolCalls"];
		if (m.toolCalls) {
			try {
				parsedToolCalls = JSON.parse(m.toolCalls);
			} catch {
				parsedToolCalls = undefined;
			}
		}
		return {
			role: m.role as "user" | "assistant" | "system",
			content: m.content,
			toolCalls: parsedToolCalls,
		};
	});
}

/**
 * The model sometimes returns no text at all (e.g. after a tool round that turned up
 * nothing useful to say). A canned "I have processed your request" is a dead end for the
 * user — surface whatever real, grounded data this turn actually found instead, or an
 * honest "I don't have that" when it found nothing.
 */
export function fallbackAnswer(
	groundedLabels: Array<{ id: string; label: string }>,
): string {
	const uniqueLabels = Array.from(
		new Map(groundedLabels.map((g) => [g.id, g.label])).values(),
	);
	if (uniqueLabels.length === 0) {
		return "I couldn't put together an answer for that — could you tell me a bit more, or ask it a different way?";
	}
	if (uniqueLabels.length === 1) {
		return `I found ${uniqueLabels[0]}, but I'm not sure what you'd like to know about it — could you ask more specifically?`;
	}
	return `I found a few matches: ${uniqueLabels.slice(0, 8).join(", ")}. Which one did you mean?`;
}
