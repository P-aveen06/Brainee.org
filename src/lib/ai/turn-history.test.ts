import { describe, expect, it } from "vitest";
import type { aiMessages } from "@/db/schema";
import { fallbackAnswer, reconstructHistory } from "./turn-history";

describe("turn-history reconstructHistory", () => {
	const baseRow: typeof aiMessages.$inferSelect = {
		id: "msg-1",
		conversationId: "cnv-1",
		turnId: null,
		toolRound: null,
		sequence: 0,
		role: "user",
		content: "Hello",
		citations: null,
		toolCalls: null,
		toolCallId: null,
		modelId: null,
		tokensIn: null,
		tokensOut: null,
		latencyMs: null,
		createdAt: new Date(),
	};

	it("reconstructs conversation history starting from first user message", () => {
		const rows: Array<typeof aiMessages.$inferSelect> = [
			{
				...baseRow,
				id: "msg-0",
				role: "tool" as const,
				content: '{"result":"old"}',
			},
			{
				...baseRow,
				id: "msg-1",
				role: "user" as const,
				content: "What is the status?",
			},
			{
				...baseRow,
				id: "msg-2",
				role: "assistant" as const,
				content: "Looking up...",
			},
		];

		const history = reconstructHistory(rows, () => true);
		expect(history).toHaveLength(2);
		expect(history[0].role).toBe("user");
		expect(history[0].content).toBe("What is the status?");
	});

	it("safely handles malformed JSON in tool message content without throwing", () => {
		const rows: Array<typeof aiMessages.$inferSelect> = [
			{ ...baseRow, id: "msg-1", role: "user" as const, content: "Run tool" },
			{
				...baseRow,
				id: "msg-2",
				role: "tool" as const,
				content: "NOT_VALID_JSON{{{",
				toolCallId: "call_123",
			},
		];

		expect(() => reconstructHistory(rows, () => true)).not.toThrow();
		const history = reconstructHistory(rows, () => true);
		expect(history).toHaveLength(2);
		expect(history[1].role).toBe("tool");
		expect(history[1].content).toContain("NOT_VALID_JSON{{{");
	});

	it("safely handles malformed JSON in toolCalls without throwing", () => {
		const rows: Array<typeof aiMessages.$inferSelect> = [
			{ ...baseRow, id: "msg-1", role: "user" as const, content: "Hello" },
			{
				...baseRow,
				id: "msg-2",
				role: "assistant" as const,
				content: "Thinking",
				toolCalls: "{malformed tool calls",
			},
		];

		expect(() => reconstructHistory(rows, () => true)).not.toThrow();
		const history = reconstructHistory(rows, () => true);
		expect(history[1].toolCalls).toBeUndefined();
	});

	it("redacts project tool payload when project is no longer visible", () => {
		const rows: Array<typeof aiMessages.$inferSelect> = [
			{
				...baseRow,
				id: "msg-1",
				role: "user" as const,
				content: "Show secret",
			},
			{
				...baseRow,
				id: "msg-2",
				role: "tool" as const,
				content: JSON.stringify({
					scopeProjectId: "secret-prj",
					result: { data: 42 },
				}),
				toolCallId: "call_1",
			},
		];

		const history = reconstructHistory(rows, (pId) => pId !== "secret-prj");
		expect(history[1].content).toContain(
			"That project is no longer accessible.",
		);
	});
});

describe("turn-history fallbackAnswer", () => {
	it("returns polite fallback when no grounded labels exist", () => {
		const res = fallbackAnswer([]);
		expect(res).toContain("I couldn't put together an answer");
	});

	it("mentions grounded labels when available", () => {
		const res = fallbackAnswer([{ id: "1", label: "Project Alpha" }]);
		expect(res).toContain("Project Alpha");
	});
});
