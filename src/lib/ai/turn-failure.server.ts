import { and, eq, isNotNull, lt } from "drizzle-orm";
import type { Database } from "@/db";
import {
	aiMessages,
	aiProposedActions,
	aiToolInvocations,
	aiTurns,
} from "@/db/schema";
import type { AssistantFailureCode } from "./ai-errors";

const STALE_TURN_MS = 40_000;

function failureContent(label: string, publicMessage: string) {
	return `⚠️ ${label}: ${publicMessage}`;
}

export async function persistTurnFailure(input: {
	db: Database;
	turnId: string;
	conversationId: string;
	assistantMessageId: string;
	code: AssistantFailureCode;
	label: string;
	publicMessage: string;
	latencyMs?: number;
}) {
	const [turn] = await input.db
		.select({ id: aiTurns.id })
		.from(aiTurns)
		.where(eq(aiTurns.id, input.turnId))
		.limit(1);
	if (!turn) return [];

	await input.db
		.update(aiTurns)
		.set({
			status: "failed",
			failureCode: input.code,
			completedAt: new Date(),
		})
		.where(eq(aiTurns.id, input.turnId));

	const [existingMessage] = await input.db
		.select({ id: aiMessages.id })
		.from(aiMessages)
		.where(eq(aiMessages.id, input.assistantMessageId))
		.limit(1);
	if (!existingMessage) {
		await input.db.insert(aiMessages).values({
			id: input.assistantMessageId,
			conversationId: input.conversationId,
			turnId: input.turnId,
			sequence: 999,
			role: "assistant",
			content: failureContent(input.label, input.publicMessage),
			latencyMs: input.latencyMs,
		});
	}

	return input.db
		.select()
		.from(aiProposedActions)
		.where(eq(aiProposedActions.messageId, input.assistantMessageId));
}

export async function recoverStaleAssistantTurns(
	db: Database,
	conversationId: string,
	userId: string,
) {
	const stale = await db
		.select({ id: aiTurns.id })
		.from(aiTurns)
		.where(
			and(
				eq(aiTurns.conversationId, conversationId),
				eq(aiTurns.userId, userId),
				eq(aiTurns.status, "running"),
				lt(aiTurns.startedAt, new Date(Date.now() - STALE_TURN_MS)),
			),
		);

	for (const turn of stale) {
		const [visibleAnswer] = await db
			.select({ id: aiMessages.id })
			.from(aiMessages)
			.where(
				and(
					eq(aiMessages.turnId, turn.id),
					eq(aiMessages.role, "assistant"),
					isNotNull(aiMessages.content),
				),
			)
			.limit(1);
		if (visibleAnswer) {
			await db
				.update(aiTurns)
				.set({ status: "completed", completedAt: new Date() })
				.where(eq(aiTurns.id, turn.id));
			continue;
		}
		const [invocation] = await db
			.select({ messageId: aiToolInvocations.messageId })
			.from(aiToolInvocations)
			.where(eq(aiToolInvocations.turnId, turn.id))
			.limit(1);
		const assistantMessageId = invocation?.messageId || `msg-failed-${turn.id}`;

		await persistTurnFailure({
			db,
			turnId: turn.id,
			conversationId,
			assistantMessageId,
			code: "request_interrupted",
			label: "Interrupted",
			publicMessage:
				"This response stopped before completion. Please retry; do not assume the requested action was performed.",
		});
	}
}
