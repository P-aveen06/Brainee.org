import type { ChatCompletionRequest, ChatCompletionResult } from "../provider";

interface OpenCodeStreamOptions {
	apiKey: string;
	baseUrl: string;
	sessionId: string;
	model: string;
	request: ChatCompletionRequest;
	onTextDelta: (delta: string) => void;
}

type Protocol = "responses" | "chat-completions";

interface StreamPayload {
	delta?: string;
	error?: { message?: string };
	response?: {
		error?: { message?: string };
		usage?: {
			input_tokens?: number;
			output_tokens?: number;
			total_tokens?: number;
		};
	};
	choices?: Array<{ delta?: { content?: unknown } }>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

function isProtocolUnsupported(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return (
		message.includes("ModelProtocolUnsupported") ||
		message.includes("does not support this protocol")
	);
}

function responseInput(
	request: ChatCompletionRequest,
): Array<Record<string, unknown>> {
	return request.messages.flatMap<Record<string, unknown>>((message) => {
		if (message.role === "tool") {
			return [
				{
					type: "function_call_output",
					call_id: message.toolCallId || "unknown",
					output: message.content || "",
				},
			];
		}
		if (message.toolCalls?.length) {
			return message.toolCalls.map((toolCall) => ({
				type: "function_call",
				name: toolCall.name,
				call_id: toolCall.id,
				arguments: JSON.stringify(toolCall.arguments),
			}));
		}
		return [{ role: message.role, content: message.content || "" }];
	});
}

function chatMessages(request: ChatCompletionRequest) {
	return [
		{ role: "system", content: request.system },
		...request.messages.map((message) => {
			if (message.role === "tool") {
				return {
					role: "tool",
					content: message.content || "",
					tool_call_id: message.toolCallId || "unknown",
				};
			}
			if (message.toolCalls?.length) {
				return {
					role: "assistant",
					content: message.content || "",
					tool_calls: message.toolCalls.map((toolCall) => ({
						id: toolCall.id,
						type: "function",
						function: {
							name: toolCall.name,
							arguments: JSON.stringify(toolCall.arguments),
						},
					})),
				};
			}
			return { role: message.role, content: message.content || "" };
		}),
	];
}

async function readSse(
	response: Response,
	onEvent: (event: string, data: string) => void,
): Promise<void> {
	if (!response.body) throw new Error("OpenCode returned an empty stream.");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const consumeFrame = (frame: string) => {
		let event = "message";
		const data: string[] = [];
		for (const line of frame.replace(/\r\n/g, "\n").split("\n")) {
			if (line.startsWith("event:")) event = line.slice(6).trim();
			else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
		}
		if (data.length) onEvent(event, data.join("\n"));
	};

	try {
		while (true) {
			const { value, done } = await reader.read();
			buffer += decoder.decode(value, { stream: !done });
			buffer = buffer.replace(/\r\n/g, "\n");
			let boundary = buffer.indexOf("\n\n");
			while (boundary >= 0) {
				consumeFrame(buffer.slice(0, boundary));
				buffer = buffer.slice(boundary + 2);
				boundary = buffer.indexOf("\n\n");
			}
			if (done) break;
		}
		if (buffer.trim()) consumeFrame(buffer);
	} catch (error) {
		await reader.cancel(error).catch(() => {});
		throw error;
	} finally {
		reader.releaseLock();
	}
}

async function streamWithProtocol(
	options: OpenCodeStreamOptions,
	protocol: Protocol,
	startedAt: number,
): Promise<ChatCompletionResult> {
	const { request, model, baseUrl, apiKey, sessionId, onTextDelta } = options;
	const cleanBase = baseUrl
		.replace(/\/chat\/completions$/, "")
		.replace(/\/responses$/, "");
	const isResponses = protocol === "responses";
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"x-opencode-session": sessionId,
	};
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
	const body = isResponses
		? {
				model,
				instructions: request.system,
				input: responseInput(request),
				max_output_tokens: request.maxTokens ?? 1024,
				stream: true,
			}
		: {
				model,
				messages: chatMessages(request),
				max_tokens: request.maxTokens ?? 1024,
				stream: true,
				stream_options: { include_usage: true },
			};
	const response = await fetch(
		`${cleanBase}/${isResponses ? "responses" : "chat/completions"}`,
		{
			method: "POST",
			headers,
			body: JSON.stringify(body),
			signal: request.signal,
		},
	);
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`OpenCode API error (${response.status}): ${errorText}`);
	}

	const textParts: string[] = [];
	let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
	await readSse(response, (event, data) => {
		if (data === "[DONE]") return;
		let payload: StreamPayload;
		try {
			payload = JSON.parse(data) as StreamPayload;
		} catch {
			return;
		}

		if (isResponses) {
			if (
				event === "response.output_text.delta" &&
				typeof payload.delta === "string"
			) {
				textParts.push(payload.delta);
				onTextDelta(payload.delta);
			}
			if (event === "response.completed") {
				const responseUsage = payload.response?.usage;
				usage = {
					promptTokens: responseUsage?.input_tokens || 0,
					completionTokens: responseUsage?.output_tokens || 0,
					totalTokens: responseUsage?.total_tokens || 0,
				};
			}
			if (event === "error" || event === "response.failed") {
				throw new Error(
					payload.error?.message ||
						payload.response?.error?.message ||
						"OpenCode stream failed.",
				);
			}
			return;
		}

		if (payload.error) {
			throw new Error(payload.error.message || "OpenCode stream failed.");
		}
		const delta = payload.choices?.[0]?.delta?.content;
		if (typeof delta === "string" && delta) {
			textParts.push(delta);
			onTextDelta(delta);
		}
		if (payload.usage) {
			usage = {
				promptTokens: payload.usage.prompt_tokens || 0,
				completionTokens: payload.usage.completion_tokens || 0,
				totalTokens: payload.usage.total_tokens || 0,
			};
		}
	});

	return {
		text: textParts.join(""),
		usage,
		modelId: model,
		latencyMs: Date.now() - startedAt,
	};
}

export async function streamOpenCodeCompletion(
	options: OpenCodeStreamOptions,
): Promise<ChatCompletionResult> {
	const startedAt = Date.now();
	const prefersResponses =
		options.model.toLowerCase().startsWith("gpt-") ||
		options.baseUrl.endsWith("/responses");
	let protocol: Protocol = prefersResponses ? "responses" : "chat-completions";
	let emittedText = false;
	const trackedOptions = {
		...options,
		onTextDelta(delta: string) {
			emittedText = true;
			options.onTextDelta(delta);
		},
	};
	try {
		return await streamWithProtocol(trackedOptions, protocol, startedAt);
	} catch (error) {
		if (
			options.request.signal?.aborted ||
			emittedText ||
			!isProtocolUnsupported(error)
		) {
			throw error;
		}
		protocol = protocol === "responses" ? "chat-completions" : "responses";
		return streamWithProtocol(trackedOptions, protocol, startedAt);
	}
}
