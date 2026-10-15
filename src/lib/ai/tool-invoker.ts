import { aiToolInvocations } from "@/db/schema";
import { TOOL_TIMEOUT_MS } from "./completion-timeout";
import type { ToolCall } from "./provider";
import type { ToolContext, ToolExecutionResult } from "./tools/tool-types";
import { getToolHandler } from "./tools-registry";

export interface InvokerTurnResults {
	toolOutputs: Array<{
		toolCallId: string;
		name: string;
		result: ToolExecutionResult;
	}>;
	allGroundedIds: Set<string>;
	allGroundedLabels: Array<{ id: string; label: string }>;
	proposedActions: Array<{
		actionType: string;
		targetEntityType: string;
		targetEntityId: string;
		payload: Record<string, unknown>;
	}>;
}

async function executeWithTimeout(
	handler: NonNullable<ReturnType<typeof getToolHandler>>,
	call: ToolCall,
	ctx: ToolContext,
): Promise<ToolExecutionResult> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<ToolExecutionResult>((resolve) => {
		timer = setTimeout(
			() =>
				resolve({
					success: false,
					error: `Tool '${call.name}' timed out after ${TOOL_TIMEOUT_MS / 1000} seconds.`,
				}),
			TOOL_TIMEOUT_MS,
		);
	});
	try {
		return await Promise.race([handler.execute(call.arguments, ctx), timeout]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

export async function executeToolCalls(
	toolCalls: ToolCall[],
	ctx: ToolContext,
	messageId?: string,
	meta?: { turnId: string; toolRound: number },
): Promise<InvokerTurnResults> {
	const toolOutputs: InvokerTurnResults["toolOutputs"] = [];
	const allGroundedIds = new Set<string>();
	const allGroundedLabels: InvokerTurnResults["allGroundedLabels"] = [];
	const proposedActions: InvokerTurnResults["proposedActions"] = [];

	for (const call of toolCalls) {
		const startedAt = Date.now();
		const handler = getToolHandler(call.name);
		let executionResult: ToolExecutionResult;

		if (!handler) {
			executionResult = {
				success: false,
				error: `Tool '${call.name}' is not recognized or permitted.`,
			};
		} else {
			try {
				executionResult = await executeWithTimeout(handler, call, ctx);
			} catch (err: unknown) {
				executionResult = {
					success: false,
					error:
						err instanceof Error
							? err.message
							: "Internal error during tool execution.",
				};
			}
		}

		// Security audit trail: insert into ai_tool_invocations
		try {
			const serializedResult = JSON.stringify(
				executionResult.data ?? { error: executionResult.error },
			);
			await ctx.db.insert(aiToolInvocations).values({
				id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				messageId: messageId || null,
				turnId: meta?.turnId,
				toolRound: meta?.toolRound,
				userId: ctx.user.id,
				toolName: call.name,
				args: JSON.stringify(call.arguments),
				resultRowCount: Array.isArray(executionResult.data)
					? executionResult.data.length
					: executionResult.data
						? 1
						: 0,
				resultBytes: new TextEncoder().encode(serializedResult).length,
				durationMs: Date.now() - startedAt,
				success: executionResult.success,
				deniedReason: executionResult.error || null,
			});
		} catch (auditErr) {
			console.error(
				"Failed to record ai_tool_invocations audit row:",
				auditErr,
			);
		}

		if (executionResult.groundedRecordIds) {
			for (const id of executionResult.groundedRecordIds) {
				allGroundedIds.add(id);
			}
		}

		if (executionResult.groundedLabels) {
			allGroundedLabels.push(...executionResult.groundedLabels);
		}

		if (executionResult.proposedAction) {
			proposedActions.push(executionResult.proposedAction);
		}

		toolOutputs.push({
			toolCallId: call.id,
			name: call.name,
			result: executionResult,
		});
	}

	return {
		toolOutputs,
		allGroundedIds,
		allGroundedLabels,
		proposedActions,
	};
}
