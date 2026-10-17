import type { GroundedLabel } from "./citations";
import { desc, eq } from "@/db/graph-query";
import { aiConversations, aiMessages, aiTurns } from "@/db/schema";
import { getEnvVar } from "@/lib/auth.server";
import { visibleProjectIdsFor } from "@/lib/project-access";
import type { AssistantChartSpec } from "./chart-types";
import {
	type CitationRef,
	matchGroundedCitation,
	sanitizeModelOutputDelta,
	sanitizeModelOutputText,
	validateCitations,
} from "./citations";
import {
	completeWithinDeadline,
	streamWithinDeadline,
	TURN_TIMEOUT_MS,
} from "./completion-timeout";
import { getForcedToolForIntent } from "./intent-routing";
import type { AssistantPageContext } from "./page-context";
import {
	ALLOWED_MODEL_IDS,
	type ChatCompletionResult,
	type ChatMessage,
	type ChatProvider,
} from "./provider";
import { OpenCodeProvider } from "./providers/opencode";
import { StubProvider } from "./providers/stub";
import type { ToolContext } from "./tools/tool-types";
import { loadWorkBrief } from "./tools/work-brief-data";
import { getAssistantSystemPrompt, getToolDefinitions } from "./tools-registry";
import {
	MAX_CONVERSATION_HISTORY_ROWS,
	MAX_TOOL_RESULT_BYTES,
	MAX_TOOL_ROUNDS,
	MAX_TOTAL_TOOL_CALLS,
	selectToolCalls,
} from "./turn-budget";
import { fallbackAnswer, reconstructHistory } from "./turn-history";
import {
	executeAndPersistToolRound,
	recordDroppedToolCalls,
} from "./turn-tool-round";

export interface AssistantTurnInput {
	conversationId: string;
	userMessage: string;
	providerOverride?: ChatProvider;
	customModelId?: string;
	pageContext?: AssistantPageContext;
	turnId?: string;
	assistantMessageId?: string;
	signal?: AbortSignal;
	onTextDelta?: (delta: string) => void;
}

export interface AssistantTurnOutput {
	messageId: string;
	content: string;
	citations: CitationRef[];
	proposedActions: Array<{
		id: string;
		actionType: string;
		targetEntityType: string;
		targetEntityId: string;
		payload: string;
		status: string;
	}>;
	charts: AssistantChartSpec[];
	modelId?: string;
	tokens: { in: number; out: number };
	latencyMs: number;
}

function newId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function runAssistantTurn(
	input: AssistantTurnInput,
	ctx: ToolContext,
): Promise<AssistantTurnOutput> {
	const startTime = Date.now();
	const deadlineMs = startTime + TURN_TIMEOUT_MS;

	const opencodeKey = getEnvVar("OPENCODE_API_KEY") || "";
	const opencodeEndpoint =
		getEnvVar("OPENCODE_ENDPOINT") ||
		getEnvVar("OPENCODE_BASE_URL") ||
		"https://opencode.ai/inference/openai/v1";
	const opencodeModel = getEnvVar("OPENCODE_MODEL") || "deepseek-v4-flash";

	const requestedModelId =
		input.customModelId && ALLOWED_MODEL_IDS.has(input.customModelId)
			? input.customModelId
			: opencodeModel;

	const provider: ChatProvider =
		input.providerOverride ||
		(opencodeKey
			? new OpenCodeProvider(
					opencodeKey,
					opencodeEndpoint,
					requestedModelId,
					input.conversationId,
				)
			: new StubProvider());

	// Fetch complete recent multi-hop history. Sequence disambiguates rows written in one second.
	// to a project the caller can no longer see is redacted before it reaches the model.
	const visibleProjectIds = await visibleProjectIdsFor(ctx.db, ctx.user);
	const canSeeProject = (projectId: string) =>
		visibleProjectIds === "all" || visibleProjectIds.includes(projectId);

	const historyRows = await ctx.db
		.select()
		.from(aiMessages)
		.where(eq(aiMessages.conversationId, input.conversationId))
		.orderBy(desc(aiMessages.createdAt), desc(aiMessages.sequence))
		.limit(MAX_CONVERSATION_HISTORY_ROWS);

	const hasAvailabilityCharts = historyRows.some((row) => {
		if (row.role !== "tool" || !row.content) return false;
		try {
			const stored = JSON.parse(row.content) as { scopeUserIds?: unknown };
			return (
				Array.isArray(stored.scopeUserIds) && stored.scopeUserIds.length > 0
			);
		} catch {
			return false;
		}
	});
	const currentBrief = hasAvailabilityCharts
		? await loadWorkBrief(ctx)
		: undefined;
	const canSeeChartScope = (projectIds: string[], userIds: string[]) => {
		if (!currentBrief) return false;
		const projects = new Set(currentBrief.projectIds);
		const people = new Set(
			currentBrief.relevantPeople.map((person) => person.id),
		);
		return (
			projectIds.every((id) => projects.has(id)) &&
			userIds.every((id) => people.has(id))
		);
	};
	const conversationHistory: ChatMessage[] = reconstructHistory(
		historyRows.reverse(),
		canSeeProject,
		canSeeChartScope,
	);
	const forcedInitialTool = getForcedToolForIntent(
		input.userMessage,
		conversationHistory,
	);

	const turnId = input.turnId ?? newId("turn");
	await ctx.db.insert(aiTurns).values({
		id: turnId,
		conversationId: input.conversationId,
		userId: ctx.user.id,
		status: "running",
	});
	let sequence = 0;
	const userMsgId = newId("msg-usr");
	await ctx.db.insert(aiMessages).values({
		id: userMsgId,
		conversationId: input.conversationId,
		turnId,
		sequence,
		role: "user",
		content: input.userMessage,
		tokensIn: input.userMessage.length / 4,
	});

	conversationHistory.push({ role: "user", content: input.userMessage });

	const tools = getToolDefinitions();
	const systemPrompt = getAssistantSystemPrompt(input.pageContext, ctx.user);
	const groundedRecordIds = new Set<string>();
	const groundedLabels: GroundedLabel[] = [];
	const createdProposals: AssistantTurnOutput["proposedActions"] = [];
	const charts: AssistantChartSpec[] = [];
	const assistantMsgId = input.assistantMessageId ?? newId("msg-ast");
	const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
	const addUsage = (result: ChatCompletionResult) => {
		usage.promptTokens += result.usage.promptTokens;
		usage.completionTokens += result.usage.completionTokens;
		usage.totalTokens += result.usage.totalTokens;
	};
	let streamBuffer = "";
	let streamedRawText = "";
	let streamStarted = false;
	const emitSafeText = (delta: string, final = false) => {
		streamBuffer += delta;
		let boundary = final ? streamBuffer.length : -1;
		if (!final) {
			for (let index = streamBuffer.length - 1; index >= 0; index -= 1) {
				if (/\s/.test(streamBuffer[index])) {
					boundary = index + 1;
					break;
				}
			}
		}
		if (boundary <= 0) return;
		let safeDelta = sanitizeModelOutputDelta(streamBuffer.slice(0, boundary));
		streamBuffer = streamBuffer.slice(boundary);
		if (!streamStarted) safeDelta = safeDelta.trimStart();
		if (final) safeDelta = safeDelta.trimEnd();
		if (safeDelta) {
			streamStarted = true;
			input.onTextDelta?.(safeDelta);
		}
	};
	const streamFinalAnswer = async () => {
		const result = await streamWithinDeadline(
			provider,
			{
				system: systemPrompt,
				messages: conversationHistory,
				maxTokens: 1024,
				modelId: requestedModelId,
				signal: input.signal,
			},
			deadlineMs,
			(delta) => {
				streamedRawText += delta;
				emitSafeText(delta);
			},
		);
		addUsage(result);
		return result;
	};
	const seenCallKeys = new Set<string>();
	let totalToolCalls = 0;
	let completedToolRounds = 0;
	let toolResultBytes = 0;
	let completion: ChatCompletionResult | undefined;

	for (let toolRound = 0; toolRound < MAX_TOOL_ROUNDS; toolRound += 1) {
		completion = await completeWithinDeadline(
			provider,
			{
				system: systemPrompt,
				messages: conversationHistory,
				tools,
				maxTokens: 1024,
				toolChoice:
					toolRound === 0 && forcedInitialTool
						? { name: forcedInitialTool }
						: undefined,
				modelId: requestedModelId,
				signal: input.signal,
			},
			deadlineMs,
		);
		addUsage(completion);
		if (!completion.toolCalls?.length) {
			completion = await streamFinalAnswer();
			break;
		}

		const selected = selectToolCalls({
			calls: completion.toolCalls,
			totalCalls: totalToolCalls,
			seenCallKeys,
		});
		await recordDroppedToolCalls(selected.dropped, ctx, assistantMsgId, {
			turnId,
			toolRound,
		});
		if (selected.accepted.length === 0) break;

		sequence += 1;
		const round = await executeAndPersistToolRound({
			calls: selected.accepted,
			conversationId: input.conversationId,
			finalMessageId: assistantMsgId,
			turnId,
			toolRound,
			sequence,
			ctx,
		});
		sequence = round.nextSequence;
		conversationHistory.push(...round.historyMessages);
		totalToolCalls += selected.accepted.length;
		completedToolRounds += 1;
		toolResultBytes += round.resultBytes;
		for (const id of round.groundedIds) groundedRecordIds.add(id);
		groundedLabels.push(...round.groundedLabels);
		createdProposals.push(...round.proposals);
		charts.push(...round.charts);

		const mustSynthesize =
			toolRound === MAX_TOOL_ROUNDS - 1 ||
			totalToolCalls >= MAX_TOTAL_TOOL_CALLS ||
			toolResultBytes >= MAX_TOOL_RESULT_BYTES;
		if (mustSynthesize) {
			completion = await streamFinalAnswer();
			break;
		}
	}

	if (!completion || completion.toolCalls?.length) {
		completion = await streamFinalAnswer();
	}

	// 4. Citation validation & hygiene — citations are matched by content against this
	// turn's real grounded labels, never guessed by bracket position.
	const rawContent = completion.text || fallbackAnswer(groundedLabels);
	if (!streamedRawText) {
		streamedRawText = rawContent;
		emitSafeText(rawContent);
	} else if (rawContent.startsWith(streamedRawText)) {
		const missingText = rawContent.slice(streamedRawText.length);
		if (missingText) emitSafeText(missingText);
	}
	emitSafeText("", true);
	const sanitized = sanitizeModelOutputText(rawContent);

	const citationMatches = sanitized.match(/\[([^\]]+)\]/g) || [];
	const claimedCitations: CitationRef[] = citationMatches.map((m) => {
		const label = m.slice(1, -1);
		const matchedId = matchGroundedCitation(label, groundedLabels);
		return {
			id: matchedId ?? `unverified:${label}`,
			type:
				groundedLabels.find(
					(entry) =>
						entry.id === matchedId &&
						entry.label.toLowerCase() === label.toLowerCase(),
				)?.type ?? (label.includes("#") ? "task" : "project"),
			label,
		};
	});

	const citationCheck = validateCitations(
		sanitized,
		claimedCitations,
		groundedRecordIds,
	);

	// 5. Persist the final, visible assistant answer
	await ctx.db.insert(aiMessages).values({
		id: assistantMsgId,
		conversationId: input.conversationId,
		turnId,
		sequence,
		role: "assistant",
		content: citationCheck.sanitizedText,
		citations: JSON.stringify(citationCheck.verifiedCitations),
		modelId: completion.modelId,
		tokensIn: usage.promptTokens,
		tokensOut: usage.completionTokens,
		latencyMs: Date.now() - startTime,
	});

	await ctx.db
		.update(aiTurns)
		.set({
			status: "completed",
			modelId: completion.modelId,
			toolRounds: completedToolRounds,
			toolCalls: totalToolCalls,
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.totalTokens,
			toolResultBytes,
			completedAt: new Date(),
		})
		.where(eq(aiTurns.id, turnId));

	await ctx.db
		.update(aiConversations)
		.set({
			lastMessageAt: new Date(),
			title: input.userMessage.slice(0, 45),
			updatedAt: new Date(),
		})
		.where(eq(aiConversations.id, input.conversationId));

	return {
		messageId: assistantMsgId,
		content: citationCheck.sanitizedText,
		citations: citationCheck.verifiedCitations,
		proposedActions: createdProposals,
		charts,
		modelId: completion.modelId,
		tokens: {
			in: usage.promptTokens,
			out: usage.completionTokens,
		},
		latencyMs: Date.now() - startTime,
	};
}
