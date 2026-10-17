/**
 * Pluggable AI Provider Interface.
 * Zero vendor coupling in core application logic.
 */

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface ChatMessage {
	role: "user" | "assistant" | "system" | "tool";
	content: string | null;
	toolCalls?: ToolCall[];
	toolCallId?: string;
}

export interface ChatUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface ChatCompletionResult {
	text?: string;
	toolCalls?: ToolCall[];
	usage: ChatUsage;
	modelId: string;
	latencyMs: number;
}

export interface ChatCompletionRequest {
	system: string;
	messages: ChatMessage[];
	tools?: ToolDefinition[];
	maxTokens?: number;
	modelId?: string;
	signal?: AbortSignal;
	toolChoice?: "auto" | "required" | { name: string };
}

export interface ChatProvider {
	complete(req: ChatCompletionRequest): Promise<ChatCompletionResult>;
	stream?(
		req: ChatCompletionRequest,
		onTextDelta: (delta: string) => void,
	): Promise<ChatCompletionResult>;
}

/** Models a caller may request from OpenCode. Anything else silently falls back to the provider default. */
export const ALLOWED_MODEL_IDS = new Set([
	"deepseek-v4-flash",
	"DeepSeek-V4-Flash",
	"gpt-6-luna",
	"gpt-6-astra",
	"gpt-6-sol",
	"claude-sonnet-5",
	"big-pickle",
	"beam-free",
]);
