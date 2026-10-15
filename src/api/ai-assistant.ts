import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte } from "drizzle-orm";
import { createDb } from "@/db";
import { aiConversations, aiMessages } from "@/db/schema";
import { classifyAssistantFailure } from "@/lib/ai/ai-errors";
import { runAssistantTurn } from "@/lib/ai/assistant-turn";
import { verifyAssistantPageContext } from "@/lib/ai/page-context.server";
import {
	persistTurnFailure,
	recoverStaleAssistantTurns,
} from "@/lib/ai/turn-failure.server";
import { authMiddleware } from "@/lib/server-fn";
import { sendMessageSchema } from "./ai-assistant-schema";

export * from "./ai-assistant-conversations";
export * from "./ai-assistant-proposals";
export * from "./ai-assistant-schema";

const HOURLY_MESSAGE_LIMIT = 60;
const DAILY_MESSAGE_LIMIT = 500;
const DAILY_TOKEN_LIMIT = 2_000_000;

export const sendAiMessage = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => sendMessageSchema.parse(data))
	.handler(async ({ data, context }) => {
		const db = createDb(env.DATABASE);

		// 1. Rate limiting: max messages and total tokens per user per 24 hours (and hourly burst protection)
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
		const todaysRows = await db
			.select({
				role: aiMessages.role,
				tokensIn: aiMessages.tokensIn,
				tokensOut: aiMessages.tokensOut,
				createdAt: aiMessages.createdAt,
			})
			.from(aiMessages)
			.innerJoin(
				aiConversations,
				eq(aiMessages.conversationId, aiConversations.id),
			)
			.where(
				and(
					eq(aiConversations.userId, context.user.id),
					gte(aiMessages.createdAt, oneDayAgo),
				),
			);

		const messagesSentLastHour = todaysRows.filter(
			(r) =>
				r.role === "user" &&
				r.createdAt &&
				new Date(r.createdAt).getTime() >= oneHourAgo.getTime(),
		).length;
		if (messagesSentLastHour >= HOURLY_MESSAGE_LIMIT) {
			return {
				error: `Hourly AI Assistant turn limit reached (${HOURLY_MESSAGE_LIMIT} messages/hour). Please wait a few minutes before asking more questions.`,
			};
		}

		const messagesSentToday = todaysRows.filter(
			(r) => r.role === "user",
		).length;
		if (messagesSentToday >= DAILY_MESSAGE_LIMIT) {
			return {
				error: `Daily AI Assistant turn limit reached (${DAILY_MESSAGE_LIMIT} messages/day).`,
			};
		}

		const tokensUsedToday = todaysRows.reduce(
			(sum, r) => sum + (r.tokensIn || 0) + (r.tokensOut || 0),
			0,
		);
		if (tokensUsedToday >= DAILY_TOKEN_LIMIT) {
			return {
				error: `Daily AI Assistant token limit reached (${DAILY_TOKEN_LIMIT.toLocaleString()} tokens/day).`,
			};
		}

		// 2. Ensure conversation exists
		let conversationId = data.conversationId;
		if (!conversationId) {
			conversationId = `cnv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
			await db.insert(aiConversations).values({
				id: conversationId,
				userId: context.user.id,
				title: data.message.slice(0, 40),
			});
		} else {
			const [conv] = await db
				.select()
				.from(aiConversations)
				.where(
					and(
						eq(aiConversations.id, conversationId),
						eq(aiConversations.userId, context.user.id),
					),
				)
				.limit(1);

			if (!conv) return { error: "Conversation not found." };
			await recoverStaleAssistantTurns(db, conversationId, context.user.id);
		}

		// 3. Execute turn
		const turnId = crypto.randomUUID();
		const assistantMessageId = `msg-ast-${crypto.randomUUID()}`;
		const turnStartedAt = Date.now();
		try {
			const pageContext = await verifyAssistantPageContext(
				db,
				context.user,
				data.pageContext,
			);
			const turnResult = await runAssistantTurn(
				{
					conversationId,
					userMessage: data.message,
					customModelId: data.modelId,
					pageContext,
					turnId,
					assistantMessageId,
				},
				{ user: context.user, db },
			);

			return {
				conversationId,
				...turnResult,
			};
		} catch (err: unknown) {
			console.error("AI assistant turn failed", err);
			const failure = classifyAssistantFailure(err);
			let proposals: Awaited<ReturnType<typeof persistTurnFailure>> = [];
			try {
				proposals = await persistTurnFailure({
					db,
					turnId,
					conversationId,
					assistantMessageId,
					code: failure.code,
					label: failure.label,
					publicMessage: failure.publicMessage,
					latencyMs: Date.now() - turnStartedAt,
				});
			} catch (persistenceError) {
				console.error("Failed to persist assistant failure", persistenceError);
			}
			return {
				conversationId,
				messageId: assistantMessageId,
				content: `⚠️ ${failure.label}: ${failure.publicMessage}`,
				citations: [],
				proposedActions: proposals.map((proposal) => ({
					id: proposal.id,
					actionType: proposal.actionType,
					targetEntityType: proposal.targetEntityType,
					targetEntityId: proposal.targetEntityId,
					payload: proposal.payload || "{}",
					status: proposal.status,
				})),
				errorCode: failure.code,
				tokens: { in: 0, out: 0 },
				latencyMs: Date.now() - turnStartedAt,
			};
		}
	});
