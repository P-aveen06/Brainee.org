import type {
	ChatCompletionResult,
	ChatMessage,
	ChatProvider,
	ToolCall,
	ToolDefinition,
} from "../provider";

export class StubProvider implements ChatProvider {
	private scriptedToolCalls?: ToolCall[];
	private scriptedResponse?: string;

	constructor(options?: {
		scriptedToolCalls?: ToolCall[];
		scriptedResponse?: string;
	}) {
		this.scriptedToolCalls = options?.scriptedToolCalls;
		this.scriptedResponse = options?.scriptedResponse;
	}

	async complete(req: {
		system: string;
		messages: ChatMessage[];
		tools?: ToolDefinition[];
		maxTokens?: number;
		modelId?: string;
	}): Promise<ChatCompletionResult> {
		const lastMsg = req.messages[req.messages.length - 1];

		// If the last message was a tool execution result, synthesize a final answer
		if (lastMsg?.role === "tool") {
			return {
				text:
					this.scriptedResponse ||
					`Based on the system records: ${lastMsg.content?.slice(0, 300)}`,
				usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
				modelId: "stub-deterministic-v1",
				latencyMs: 5,
			};
		}

		// First turn: invoke scripted tools or echo an answer
		if (this.scriptedToolCalls && this.scriptedToolCalls.length > 0) {
			return {
				toolCalls: this.scriptedToolCalls,
				usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
				modelId: "stub-deterministic-v1",
				latencyMs: 5,
			};
		}

		// Default conversational response
		const query = lastMsg?.content || "";
		return {
			text:
				this.scriptedResponse ||
				`I am Company Brain. I can help with projects, tasks, leaves, WFH, and assets. You asked: "${query}"`,
			usage: { promptTokens: 25, completionTokens: 25, totalTokens: 50 },
			modelId: "stub-deterministic-v1",
			latencyMs: 5,
		};
	}
}
