import { defineNode } from "../../../shared/graph/model";

export type ToolInvocationRow = {
	id: string;
	messageId: string | null;
	turnId: string | null;
	toolRound: number | null;
	userId: string;
	toolName: string;
	args: string | null;
	resultRowCount: number | null;
	resultBytes: number | null;
	durationMs: number | null;
	success: boolean | null;
	deniedReason: string | null;
	createdAt: Date | null;
};

export const aiToolInvocations =
	defineNode<ToolInvocationRow>("ToolInvocation");
