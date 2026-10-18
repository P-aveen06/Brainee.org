import { defineNode } from "../../../shared/graph/model";

export type MessageRow = {
	id: string;
	conversationId: string;
	turnId: string | null;
	sequence: number | null;
	toolRound: number | null;
	role: string;
	content: string | null;
	toolCalls: string | null;
	toolCallId: string | null;
	citations: string | null;
	modelId: string | null;
	tokensIn: number | null;
	tokensOut: number | null;
	latencyMs: number | null;
	createdAt: Date | null;
};

export const aiMessages = defineNode<MessageRow>("Message");
