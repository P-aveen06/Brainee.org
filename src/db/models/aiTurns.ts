import { defineNode } from "../../../shared/graph/model";

export type AssistantTurnRow = {
	id: string;
	conversationId: string;
	userId: string;
	status: string;
	modelId: string | null;
	toolRounds: number;
	toolCalls: number;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	toolResultBytes: number;
	failureCode: string | null;
	startedAt: Date | null;
	completedAt: Date | null;
};

export const aiTurns = defineNode<AssistantTurnRow>("AssistantTurn");
