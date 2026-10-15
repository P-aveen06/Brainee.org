import type {
	ChatCompletionRequest,
	ChatCompletionResult,
	ChatProvider,
} from "../provider";

export class OpenRouterProvider implements ChatProvider {
	private apiKey: string;
	private defaultModel: string;

	constructor(apiKey: string, defaultModel = "google/gemini-2.5-flash") {
		this.apiKey = apiKey;
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

		const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://brainee.local",
				"X-Title": "Brainee.org AI Assistant",
			},
			body: JSON.stringify(requestBody),
			signal: req.signal,
		});

		if (!res.ok) {
			const errText = await res.text();
			throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
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
