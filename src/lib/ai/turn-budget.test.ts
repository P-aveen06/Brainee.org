import { describe, expect, it } from "vitest";
import type { ToolCall } from "./provider";
import { selectToolCalls } from "./turn-budget";

function calls(count: number): ToolCall[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `call-${index}`,
		name: `tool_${index}`,
		arguments: { index },
	}));
}

describe("selectToolCalls", () => {
	it("limits a tool round to four calls", () => {
		const result = selectToolCalls({
			calls: calls(6),
			totalCalls: 0,
			seenCallKeys: new Set(),
		});
		expect(result.accepted).toHaveLength(4);
		expect(result.dropped).toHaveLength(2);
	});

	it("respects the remaining per-turn budget", () => {
		const result = selectToolCalls({
			calls: calls(4),
			totalCalls: 6,
			seenCallKeys: new Set(),
		});
		expect(result.accepted).toHaveLength(2);
		expect(result.dropped).toHaveLength(2);
	});

	it("deduplicates repeated name and arguments", () => {
		const duplicate = {
			id: "other-id",
			name: "tool_0",
			arguments: { index: 0 },
		};
		const result = selectToolCalls({
			calls: [calls(1)[0], duplicate],
			totalCalls: 0,
			seenCallKeys: new Set(),
		});
		expect(result.accepted).toHaveLength(1);
		expect(result.dropped[0]?.reason).toContain("Duplicate");
	});
});
