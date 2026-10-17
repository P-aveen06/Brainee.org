import { createServerFn } from "@tanstack/react-start";
import { createDb } from "@/db";
import { and, desc, eq, inArray } from "@/db/graph-query";
import { aiConversations, aiMessages, aiProposedActions } from "@/db/schema";
import { isAssistantChartSpec } from "@/lib/ai/chart-types";
import { loadWorkBrief } from "@/lib/ai/tools/work-brief-data";
import { recoverStaleAssistantTurns } from "@/lib/ai/turn-failure.server";
import { authMiddleware } from "@/lib/server-fn";
import {
	deleteConversationSchema,
	getConversationSchema,
} from "./ai-assistant-schema";

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const getAiConversations = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const db = createDb();
		const threads = await db
			.select()
			.from(aiConversations)
			.where(eq(aiConversations.userId, context.user.id))
			.orderBy(desc(aiConversations.updatedAt))
			.limit(30);

		return { conversations: threads };
	});

export const getAiConversation = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => getConversationSchema.parse(data))
	.handler(async ({ data, context }) => {
		const db = createDb();

		const [conv] = await db
			.select()
			.from(aiConversations)
			.where(
				and(
					eq(aiConversations.id, data.conversationId),
					eq(aiConversations.userId, context.user.id),
				),
			)
			.limit(1);

		if (!conv) {
			return { error: "Conversation not found." };
		}
		await recoverStaleAssistantTurns(db, data.conversationId, context.user.id);

		const allRows = await db
			.select()
			.from(aiMessages)
			.where(eq(aiMessages.conversationId, data.conversationId))
			.orderBy(aiMessages.createdAt);
		const storedCharts = allRows.flatMap((row) => {
			if (row.role !== "tool" || !row.content || !row.turnId) return [];
			const stored = safeJsonParse<Record<string, unknown> | null>(
				row.content,
				null,
			);
			const result = stored && isRecord(stored.result) ? stored.result : null;
			const chart = result?.chart;
			if (
				!isAssistantChartSpec(chart) ||
				!Array.isArray(stored?.scopeProjectIds) ||
				!stored.scopeProjectIds.every((id) => typeof id === "string") ||
				!Array.isArray(stored?.scopeUserIds) ||
				!stored.scopeUserIds.every((id) => typeof id === "string")
			) {
				return [];
			}
			return [
				{
					turnId: row.turnId,
					chart,
					projectIds: stored.scopeProjectIds as string[],
					userIds: stored.scopeUserIds as string[],
				},
			];
		});
		const chartsByTurnId = new Map<string, (typeof storedCharts)[number][]>();
		if (storedCharts.length > 0) {
			const currentBrief = await loadWorkBrief({ db, user: context.user });
			const currentProjects = new Set(currentBrief.projectIds);
			const currentPeople = new Set(
				currentBrief.relevantPeople.map((person) => person.id),
			);
			for (const stored of storedCharts) {
				if (
					!stored.projectIds.every((id) => currentProjects.has(id)) ||
					!stored.userIds.every((id) => currentPeople.has(id))
				) {
					continue;
				}
				const charts = chartsByTurnId.get(stored.turnId) || [];
				charts.push(stored);
				chartsByTurnId.set(stored.turnId, charts);
			}
		}

		// Tool-call placeholders and raw tool-result rows exist only so the next turn can
		// replay a valid provider conversation; the UI only ever shows user/assistant turns.
		const messages = allRows.filter(
			(m) =>
				m.role !== "tool" && !(m.role === "assistant" && m.content === null),
		);

		const messageIds = messages.map((m) => m.id);
		const proposals =
			messageIds.length > 0
				? await db
						.select()
						.from(aiProposedActions)
						.where(inArray(aiProposedActions.messageId, messageIds))
				: [];

		const proposalsByMessageId = new Map<
			string,
			Array<{
				id: string;
				actionType: string;
				targetEntityType: string;
				targetEntityId: string;
				payload: string;
				status: string;
			}>
		>();
		for (const p of proposals) {
			if (!p.messageId) continue;
			const list = proposalsByMessageId.get(p.messageId) || [];
			list.push({
				id: p.id,
				actionType: p.actionType,
				targetEntityType: p.targetEntityType,
				targetEntityId: p.targetEntityId,
				payload: p.payload || "{}",
				status: p.status,
			});
			proposalsByMessageId.set(p.messageId, list);
		}

		return {
			conversation: conv,
			messages: messages.map((m) => ({
				id: m.id,
				role: m.role,
				content: m.content,
				citations: safeJsonParse(m.citations, []),
				toolCalls: safeJsonParse(m.toolCalls, undefined),
				proposals: proposalsByMessageId.get(m.id) || [],
				charts:
					m.role === "assistant"
						? (chartsByTurnId.get(m.turnId ?? "") || []).map(
								(stored) => stored.chart,
							)
						: [],
				modelId: m.modelId,
				latencyMs: m.latencyMs,
				createdAt: m.createdAt,
			})),
		};
	});

export const createAiConversation = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const db = createDb();
		const id = `cnv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

		await db.insert(aiConversations).values({
			id,
			userId: context.user.id,
			title: "New Conversation",
		});

		return { conversationId: id };
	});

export const deleteAiConversation = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => deleteConversationSchema.parse(data))
	.handler(async ({ data, context }) => {
		const db = createDb();

		// ai_proposed_actions has no FK to the conversation, so the cascade that removes
		// messages and turns leaves pending proposals behind — still confirmable by id.
		// Expire them first, while the message ids are still resolvable.
		const messageIds = await db
			.select({ id: aiMessages.id })
			.from(aiMessages)
			.innerJoin(
				aiConversations,
				eq(aiMessages.conversationId, aiConversations.id),
			)
			.where(
				and(
					eq(aiMessages.conversationId, data.conversationId),
					eq(aiConversations.userId, context.user.id),
				),
			);

		if (messageIds.length > 0) {
			await db
				.update(aiProposedActions)
				.set({ status: "expired", updatedAt: new Date() })
				.where(
					and(
						inArray(
							aiProposedActions.messageId,
							messageIds.map((m) => m.id),
						),
						eq(aiProposedActions.userId, context.user.id),
						eq(aiProposedActions.status, "pending"),
					),
				);
		}

		await db
			.delete(aiConversations)
			.where(
				and(
					eq(aiConversations.id, data.conversationId),
					eq(aiConversations.userId, context.user.id),
				),
			);

		return { success: true };
	});
