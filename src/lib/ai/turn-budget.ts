import type { ToolCall } from "./provider";

export const MAX_TOOL_ROUNDS = 3;
export const MAX_TOTAL_TOOL_CALLS = 8;
export const MAX_TOOL_CALLS_PER_ROUND = 4;
export const MAX_TOOL_RESULT_BYTES = 64_000;

export interface DroppedToolCall {
	call: ToolCall;
	reason: string;
}

function callKey(call: ToolCall): string {
	return `${call.name}:${JSON.stringify(call.arguments, Object.keys(call.arguments).sort())}`;
}

export function selectToolCalls(input: {
	calls: ToolCall[];
	totalCalls: number;
	seenCallKeys: Set<string>;
}): { accepted: ToolCall[]; dropped: DroppedToolCall[] } {
	const accepted: ToolCall[] = [];
	const dropped: DroppedToolCall[] = [];
	const remaining = Math.max(0, MAX_TOTAL_TOOL_CALLS - input.totalCalls);

	for (const call of input.calls) {
		const key = callKey(call);
		if (input.seenCallKeys.has(key)) {
			dropped.push({ call, reason: "Duplicate tool call in the same turn." });
			continue;
		}
		if (accepted.length >= MAX_TOOL_CALLS_PER_ROUND) {
			dropped.push({
				call,
				reason: `Per-round tool call limit (${MAX_TOOL_CALLS_PER_ROUND}) exceeded.`,
			});
			continue;
		}
		if (accepted.length >= remaining) {
			dropped.push({
				call,
				reason: `Per-turn tool call limit (${MAX_TOTAL_TOOL_CALLS}) exceeded.`,
			});
			continue;
		}
		accepted.push(call);
		input.seenCallKeys.add(key);
	}

	return { accepted, dropped };
}
