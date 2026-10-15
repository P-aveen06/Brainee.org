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
}

/** Models a caller may request. Anything else silently falls back to the provider default. */
export const ALLOWED_MODEL_IDS = new Set([
	"DeepSeek-V4-Flash",
	"google/gemini-2.5-flash",
	"google/gemini-2.5-pro",
	"openai/gpt-4o-mini",
	"anthropic/claude-3.5-sonnet",
]);
