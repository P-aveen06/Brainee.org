import type {
	ChatCompletionRequest,
	ChatCompletionResult,
	ChatProvider,
} from "../provider";

/**
 * Azure OpenAI-compatible endpoint provider for DeepSeek-V4-Flash.
 * Endpoint: https://open-model-resource.openai.azure.com/openai/v1/chat/completions
 */
export class AzureDeepSeekProvider implements ChatProvider {
	private apiKey: string;
	private baseUrl: string;
	private defaultModel: string;

	constructor(
		apiKey = "",
		baseUrl = "https://open-model-resource.openai.azure.com/openai/v1",
		defaultModel = "DeepSeek-V4-Flash",
	) {
		this.apiKey = apiKey;
		this.baseUrl = baseUrl.replace(/\/+$/, "");
		this.defaultModel = defaultModel;
	}

	async complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
		const startTime = Date.now();
		const model = req.modelId || this.defaultModel;

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
								arguments: JSON.stringify(tc.arguments),
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

		const endpointUrl = `${this.baseUrl}/chat/completions`;

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.apiKey) {
			headers["api-key"] = this.apiKey;
		}

		const body = JSON.stringify(requestBody);
		const retryableStatuses = new Set([429, 500, 502, 503, 504]);
		const maxAttempts = 2;

		let lastError: Error | null = null;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				const res = await fetch(endpointUrl, {
					method: "POST",
					headers,
					body,
					signal: req.signal,
				});

				if (!res.ok) {
					const errText = await res.text();
					if (retryableStatuses.has(res.status) && attempt < maxAttempts - 1) {
						lastError = new Error(
							`Azure DeepSeek API error (${res.status}): ${errText}`,
						);
						await new Promise((r) => setTimeout(r, 2000));
						continue;
					}
					throw new Error(
						`Azure DeepSeek API error (${res.status}): ${errText}`,
					);
				}

				return this.parseResponse(res, model, startTime);
			} catch (err) {
				if (req.signal?.aborted) throw err;
				if (
					attempt < maxAttempts - 1 &&
					!(err instanceof Error && err.message.includes("API error"))
				) {
					lastError = err as Error;
					await new Promise((r) => setTimeout(r, 2000));
					continue;
				}
				throw err;
			}
		}

		throw (
			lastError || new Error("Azure DeepSeek: all retry attempts exhausted")
		);
	}

	private async parseResponse(
		res: Response,
		model: string,
		startTime: number,
	): Promise<ChatCompletionResult> {
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
