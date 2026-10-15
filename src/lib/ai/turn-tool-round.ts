import { aiMessages, aiProposedActions, aiToolInvocations } from "@/db/schema";
import type { ChatMessage, ToolCall } from "./provider";
import { executeToolCalls } from "./tool-invoker";
import type { ToolContext } from "./tools/tool-types";
import type { DroppedToolCall } from "./turn-budget";
import type { StoredToolPayload } from "./turn-history";

function newId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface CreatedProposal {
	id: string;
	actionType: string;
	targetEntityType: string;
	targetEntityId: string;
	payload: string;
	status: string;
}

export async function recordDroppedToolCalls(
	dropped: DroppedToolCall[],
	ctx: ToolContext,
	messageId: string,
	meta?: { turnId: string; toolRound: number },
) {
	for (const item of dropped) {
		await ctx.db.insert(aiToolInvocations).values({
			id: newId("inv"),
			messageId,
			turnId: meta?.turnId,
			toolRound: meta?.toolRound,
			userId: ctx.user.id,
			toolName: item.call.name,
			args: JSON.stringify(item.call.arguments),
			deniedReason: item.reason,
			success: false,
		});
	}
}

export async function executeAndPersistToolRound(input: {
	calls: ToolCall[];
	conversationId: string;
	finalMessageId: string;
	turnId: string;
	toolRound: number;
	sequence: number;
	ctx: ToolContext;
}): Promise<{
	historyMessages: ChatMessage[];
	groundedIds: Set<string>;
	groundedLabels: Array<{ id: string; label: string }>;
	proposals: CreatedProposal[];
	nextSequence: number;
	resultBytes: number;
}> {
	await input.ctx.db.insert(aiMessages).values({
		id: newId("msg-tc"),
		conversationId: input.conversationId,
		turnId: input.turnId,
		sequence: input.sequence,
		toolRound: input.toolRound,
		role: "assistant",
		content: null,
		toolCalls: JSON.stringify(input.calls),
	});

	const results = await executeToolCalls(
		input.calls,
		input.ctx,
		input.finalMessageId,
		{ turnId: input.turnId, toolRound: input.toolRound },
	);
	const proposals: CreatedProposal[] = [];
	for (const proposal of results.proposedActions) {
		const actionId = newId("act");
		const payload = JSON.stringify(proposal.payload);
		await input.ctx.db.insert(aiProposedActions).values({
			id: actionId,
			messageId: input.finalMessageId,
			userId: input.ctx.user.id,
			actionType: proposal.actionType,
			targetEntityType: proposal.targetEntityType,
			targetEntityId: proposal.targetEntityId,
			payload,
			status: "pending",
			expiresAt: new Date(Date.now() + 15 * 60 * 1000),
		});
		proposals.push({
			id: actionId,
			actionType: proposal.actionType,
			targetEntityType: proposal.targetEntityType,
			targetEntityId: proposal.targetEntityId,
			payload,
			status: "pending",
		});
	}

	const historyMessages: ChatMessage[] = [
		{ role: "assistant", content: null, toolCalls: input.calls },
	];
	let sequence = input.sequence + 1;
	let resultBytes = 0;
	for (const output of results.toolOutputs) {
		const resultPayload = output.result.data ?? { error: output.result.error };
		const call = input.calls.find(
			(candidate) => candidate.id === output.toolCallId,
		);
		const scopeProjectId =
			typeof call?.arguments.projectId === "string"
				? call.arguments.projectId
				: undefined;
		const serializedResult = JSON.stringify(resultPayload);
		resultBytes += new TextEncoder().encode(serializedResult).length;
		await input.ctx.db.insert(aiMessages).values({
			id: newId("msg-tool"),
			conversationId: input.conversationId,
			turnId: input.turnId,
			sequence,
			toolRound: input.toolRound,
			role: "tool",
			toolCallId: output.toolCallId,
			content: JSON.stringify({
				scopeProjectId,
				result: resultPayload,
			} satisfies StoredToolPayload),
		});
		sequence += 1;
		historyMessages.push({
			role: "tool",
			content: `<tool_data>${serializedResult}</tool_data>`,
			toolCallId: output.toolCallId,
		});
	}

	return {
		historyMessages,
		groundedIds: results.allGroundedIds,
		groundedLabels: results.allGroundedLabels,
		proposals,
		nextSequence: sequence,
		resultBytes,
	};
}
