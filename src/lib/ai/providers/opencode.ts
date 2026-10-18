import type {
	ChatCompletionRequest,
	ChatCompletionResult,
	ChatProvider,
} from "../provider";
import { streamOpenCodeCompletion } from "./opencode-stream";

/**
 * OpenCode inference endpoint provider.
 * Supports both:
 * 1. OpenAI Responses API (`/responses` for GPT-6 Luna, Astra, Sol, etc.)
 * 2. OpenAI Chat Completions API (`/chat/completions` for DeepSeek, GLM, Claude, etc.)
 * Includes mandatory `x-opencode-session` header and auto-protocol fallback.
 */
export class OpenCodeProvider implements ChatProvider {
	private apiKey: string;
	private baseUrl: string;
	private defaultModel: string;
	private sessionId: string;

	constructor(
		apiKey = "",
		baseUrl = "https://opencode.ai/zen/go/v1",
		defaultModel = "gpt-6-luna",
		sessionId?: string,
	) {
		this.apiKey = apiKey;
		this.baseUrl = baseUrl.replace(/\/+$/, "");
		this.defaultModel = defaultModel;
		this.sessionId =
			sessionId ||
			`session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
	}

	async complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
		const startTime = Date.now();
		const model = req.modelId || this.defaultModel;

		// GPT family on OpenCode Zen uses the Responses API protocol
		const prefersResponses =
			model.toLowerCase().startsWith("gpt-") ||
			this.baseUrl.endsWith("/responses");

		const retryableStatuses = new Set([429, 500, 502, 503, 504]);
		const maxAttempts = 2;

		let useResponses = prefersResponses;
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				if (useResponses) {
					return await this.callResponsesApi(req, model, startTime);
				}
				return await this.callChatCompletionsApi(req, model, startTime);
			} catch (err) {
				if (req.signal?.aborted) throw err;
				const errMsg = err instanceof Error ? err.message : String(err);

				// Auto-switch protocol if endpoint returned protocol unsupported
				if (
					errMsg.includes("ModelProtocolUnsupported") ||
					errMsg.includes("does not support this protocol")
				) {
					useResponses = !useResponses;
					continue;
				}

				if (attempt < maxAttempts - 1) {
					const isRetryable =
						Array.from(retryableStatuses).some((st) =>
							errMsg.includes(`(${st})`),
						) || !errMsg.includes("API error");
					if (isRetryable) {
						lastError = err as Error;
						await new Promise((r) => setTimeout(r, 1500));
						continue;
					}
				}
				throw err;
			}
		}

		throw lastError || new Error("OpenCode: all retry attempts exhausted");
	}

	async stream(
		req: ChatCompletionRequest,
		onTextDelta: (delta: string) => void,
	): Promise<ChatCompletionResult> {
		return streamOpenCodeCompletion({
			apiKey: this.apiKey,
			baseUrl: this.baseUrl,
			sessionId: this.sessionId,
			model: req.modelId || this.defaultModel,
			request: req,
			onTextDelta,
		});
	}

	private async callResponsesApi(
		req: ChatCompletionRequest,
		model: string,
		startTime: number,
	): Promise<ChatCompletionResult> {
		const cleanBase = this.baseUrl
			.replace(/\/chat\/completions$/, "")
			.replace(/\/responses$/, "");
		const endpointUrl = `${cleanBase}/responses`;

		const input: Array<Record<string, unknown>> = [];
		for (const m of req.messages) {
			if (m.role === "tool") {
				input.push({
					type: "function_call_output",
					call_id: m.toolCallId || "unknown",
					output: m.content || "",
				});
			} else if (m.toolCalls && m.toolCalls.length > 0) {
				for (const tc of m.toolCalls) {
					input.push({
						type: "function_call",
						name: tc.name,
						call_id: tc.id,
						arguments:
							typeof tc.arguments === "string"
								? tc.arguments
								: JSON.stringify(tc.arguments),
					});
				}
			} else {
				input.push({
					role: m.role,
					content: m.content || "",
				});
			}
		}

		const requestBody: Record<string, unknown> = {
			model,
			instructions: req.system,
			input,
			max_output_tokens: req.maxTokens ?? 1024,
		};

		if (req.tools && req.tools.length > 0) {
			requestBody.tools = req.tools.map((t) => ({
				type: "function",
				name: t.name,
				description: t.description,
				parameters: t.parameters,
			}));
			if (req.toolChoice && req.toolChoice !== "auto") {
				requestBody.tool_choice =
					req.toolChoice === "required"
						? "required"
						: { type: "function", name: req.toolChoice.name };
			}
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"x-opencode-session": this.sessionId,
		};
		if (this.apiKey) {
			headers.Authorization = `Bearer ${this.apiKey}`;
		}

		const res = await fetch(endpointUrl, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody),
			signal: req.signal,
		});

		if (!res.ok) {
			const errText = await res.text();
			throw new Error(`OpenCode API error (${res.status}): ${errText}`);
		}

		const json = (await res.json()) as {
			output?: Array<{
				type?: string;
				name?: string;
				call_id?: string;
				id?: string;
				arguments?: string;
				content?: Array<{ type?: string; text?: string }>;
			}>;
			usage?: {
				input_tokens?: number;
				output_tokens?: number;
				total_tokens?: number;
			};
		};

		const latencyMs = Date.now() - startTime;
		const outputItems = json.output || [];

		// Extract text from message output
		const textParts: string[] = [];
		for (const item of outputItems) {
			if (item.type === "message" && Array.isArray(item.content)) {
				for (const c of item.content) {
					if (c.type === "output_text" && c.text) {
						textParts.push(c.text);
					}
				}
			}
		}

		// Extract tool calls from function_call output
		const toolCalls = outputItems
			.filter((item) => item.type === "function_call" && item.name)
			.map((item) => {
				let parsedArgs: Record<string, unknown> = {};
				try {
					parsedArgs =
						typeof item.arguments === "string"
							? JSON.parse(item.arguments)
							: {};
				} catch {
					parsedArgs = {};
				}
				return {
					id: item.call_id || item.id || `call_${Date.now()}`,
					name: item.name as string,
					arguments: parsedArgs,
				};
			});

		return {
			text: textParts.length > 0 ? textParts.join("") : undefined,
			toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
			usage: {
				promptTokens: json.usage?.input_tokens || 0,
				completionTokens: json.usage?.output_tokens || 0,
				totalTokens: json.usage?.total_tokens || 0,
			},
			modelId: model,
			latencyMs,
		};
	}

	private async callChatCompletionsApi(
		req: ChatCompletionRequest,
		model: string,
		startTime: number,
	): Promise<ChatCompletionResult> {
		const cleanBase = this.baseUrl
			.replace(/\/chat\/completions$/, "")
			.replace(/\/responses$/, "");
		const endpointUrl = `${cleanBase}/chat/completions`;

		const formattedMessages = [
			{ role: "system", content: req.system },
			...req.messages.map((m) => {
				if (m.role === "tool") {
					return {
						role: "tool",
						content: m.content || "",
						tool_call_id: m.toolCallId || "unknown",
					};
				}
				if (m.toolCalls && m.toolCalls.length > 0) {
					return {
						role: "assistant",
						content: m.content || "",
						tool_calls: m.toolCalls.map((tc) => ({
							id: tc.id,
							type: "function",
							function: {
								name: tc.name,
								arguments:
									typeof tc.arguments === "string"
										? tc.arguments
										: JSON.stringify(tc.arguments),
							},
						})),
					};
				}
				return {
					role: m.role,
					content: m.content || "",
				};
			}),
		];

		const requestBody: Record<string, unknown> = {
			model,
			messages: formattedMessages,
			max_tokens: req.maxTokens ?? 1024,
		};

		if (req.tools && req.tools.length > 0) {
			requestBody.tools = req.tools.map((t) => ({
				type: "function",
				function: {
					name: t.name,
					description: t.description,
					parameters: t.parameters,
				},
			}));
			if (req.toolChoice && req.toolChoice !== "auto") {
				requestBody.tool_choice =
					req.toolChoice === "required"
						? "required"
						: {
								type: "function",
								function: { name: req.toolChoice.name },
							};
			}
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"x-opencode-session": this.sessionId,
		};
		if (this.apiKey) {
			headers.Authorization = `Bearer ${this.apiKey}`;
		}

		const res = await fetch(endpointUrl, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody),
			signal: req.signal,
		});

		if (!res.ok) {
			const errText = await res.text();
			throw new Error(`OpenCode API error (${res.status}): ${errText}`);
		}

		const json = (await res.json()) as {
			choices?: Array<{
				message?: {
					content?: string | null;
					tool_calls?: Array<{
						id: string;
						function: {
							name: string;
							arguments: string;
						};
					}>;
				};
			}>;
			usage?: {
				prompt_tokens?: number;
				completion_tokens?: number;
				total_tokens?: number;
			};
		};

		const choice = json.choices?.[0]?.message;
		const latencyMs = Date.now() - startTime;

		const toolCalls = choice?.tool_calls?.map((tc) => {
			let parsedArgs: Record<string, unknown> = {};
			try {
				parsedArgs = JSON.parse(tc.function.arguments);
			} catch {
				parsedArgs = {};
			}
			return {
				id: tc.id,
				name: tc.function.name,
				arguments: parsedArgs,
			};
		});

		return {
			text: choice?.content || undefined,
			toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
			usage: {
				promptTokens: json.usage?.prompt_tokens || 0,
				completionTokens: json.usage?.completion_tokens || 0,
				totalTokens: json.usage?.total_tokens || 0,
			},
			modelId: model,
			latencyMs,
		};
	}
}
