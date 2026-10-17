import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenCodeProvider } from "./opencode";

describe("OpenCodeProvider", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("sends request with Bearer authorization and default chat completions endpoint", async () => {
		let capturedUrl = "";
		let capturedHeaders: Record<string, string> = {};
		let capturedBody: Record<string, unknown> = {};

		globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
			capturedUrl = String(url);
			capturedHeaders = init.headers as Record<string, string>;
			capturedBody = JSON.parse(init.body as string);

			return new Response(
				JSON.stringify({
					choices: [
						{
							message: {
								role: "assistant",
								content: "Hello from OpenCode!",
							},
						},
					],
					usage: {
						prompt_tokens: 15,
						completion_tokens: 8,
						total_tokens: 23,
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});

		const provider = new OpenCodeProvider(
			"oc_sk_test_12345",
			"https://opencode.ai/inference/openai/v1",
			"deepseek-v4-flash",
			"session-abc-123",
		);

		const result = await provider.complete({
			system: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Hi" }],
		});

		expect(capturedUrl).toBe(
			"https://opencode.ai/inference/openai/v1/chat/completions",
		);
		expect(capturedHeaders.Authorization).toBe("Bearer oc_sk_test_12345");
		expect(capturedHeaders["x-opencode-session"]).toBe("session-abc-123");
		expect(capturedHeaders["Content-Type"]).toBe("application/json");
		expect(capturedBody.model).toBe("deepseek-v4-flash");
		expect(result.text).toBe("Hello from OpenCode!");
		expect(result.usage.totalTokens).toBe(23);
		expect(result.modelId).toBe("deepseek-v4-flash");
	});

	it("routes gpt-* models to the OpenAI Responses API format with x-opencode-session", async () => {
		let capturedUrl = "";
		let capturedHeaders: Record<string, string> = {};
		let capturedBody: Record<string, unknown> = {};

		globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
			capturedUrl = String(url);
			capturedHeaders = init.headers as Record<string, string>;
			capturedBody = JSON.parse(init.body as string);

			return new Response(
				JSON.stringify({
					output: [
						{
							type: "message",
							role: "assistant",
							content: [
								{ type: "output_text", text: "Hello from GPT-6 Luna!" },
							],
						},
					],
					usage: {
						input_tokens: 20,
						output_tokens: 10,
						total_tokens: 30,
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});

		const provider = new OpenCodeProvider(
			"oc_sk_test_12345",
			"https://opencode.ai/zen/go/v1",
			"gpt-6-luna",
			"session-luna-456",
		);

		const result = await provider.complete({
			system: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Hello" }],
		});

		expect(capturedUrl).toBe("https://opencode.ai/zen/go/v1/responses");
		expect(capturedHeaders.Authorization).toBe("Bearer oc_sk_test_12345");
		expect(capturedHeaders["x-opencode-session"]).toBe("session-luna-456");
		expect(capturedBody.model).toBe("gpt-6-luna");
		expect(capturedBody.instructions).toBe("You are a helpful assistant.");
		expect(result.text).toBe("Hello from GPT-6 Luna!");
		expect(result.usage.totalTokens).toBe(30);
	});

	it("parses Responses API function calls and formats function_call_output input", async () => {
		globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
			const body = JSON.parse(init.body as string);
			const hasOutput = body.input?.some(
				(item: { type?: string }) => item.type === "function_call_output",
			);

			if (hasOutput) {
				return new Response(
					JSON.stringify({
						output: [
							{
								type: "message",
								role: "assistant",
								content: [
									{
										type: "output_text",
										text: "You have 2 in-progress tasks.",
									},
								],
							},
						],
						usage: { input_tokens: 50, output_tokens: 15, total_tokens: 65 },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}

			return new Response(
				JSON.stringify({
					output: [
						{
							type: "function_call",
							name: "get_my_tasks",
							call_id: "call_task_123",
							arguments: JSON.stringify({ status: "in_progress" }),
						},
					],
					usage: { input_tokens: 30, output_tokens: 10, total_tokens: 40 },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});

		const provider = new OpenCodeProvider(
			"oc_sk_123",
			"https://opencode.ai/zen/go/v1",
			"gpt-6-luna",
		);

		// First round: model emits a function_call
		const firstRound = await provider.complete({
			system: "sys",
			messages: [{ role: "user", content: "Show my tasks" }],
			tools: [
				{
					name: "get_my_tasks",
					description: "Get user tasks",
					parameters: { type: "object" },
				},
			],
		});

		expect(firstRound.toolCalls).toHaveLength(1);
		expect(firstRound.toolCalls?.[0].name).toBe("get_my_tasks");
		expect(firstRound.toolCalls?.[0].arguments).toEqual({
			status: "in_progress",
		});

		// Second round: send tool execution output back
		const secondRound = await provider.complete({
			system: "sys",
			messages: [
				{ role: "user", content: "Show my tasks" },
				{
					role: "assistant",
					content: null,
					toolCalls: firstRound.toolCalls,
				},
				{
					role: "tool",
					content: JSON.stringify([{ id: "tsk-1", title: "Task 1" }]),
					toolCallId: "call_task_123",
				},
			],
		});

		expect(secondRound.text).toBe("You have 2 in-progress tasks.");
	});

	it("auto-switches protocol when ModelProtocolUnsupported error is encountered", async () => {
		let callCount = 0;
		globalThis.fetch = vi.fn().mockImplementation(async (url) => {
			callCount++;
			if (String(url).endsWith("/chat/completions")) {
				return new Response(
					JSON.stringify({
						type: "error",
						error: {
							type: "ModelProtocolUnsupported",
							message: "Model does not support this protocol.",
						},
					}),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response(
				JSON.stringify({
					output: [
						{
							type: "message",
							role: "assistant",
							content: [{ type: "output_text", text: "Fallback worked!" }],
						},
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});

		// Start with a model that defaults to chat.completions
		const provider = new OpenCodeProvider(
			"oc_sk_123",
			"https://opencode.ai/zen/go/v1",
			"some-custom-model",
		);

		const result = await provider.complete({
			system: "sys",
			messages: [{ role: "user", content: "Hi" }],
		});

		expect(callCount).toBe(2);
		expect(result.text).toBe("Fallback worked!");
	});

	it("throws descriptive error when OpenCode returns non-OK status", async () => {
		globalThis.fetch = vi.fn().mockImplementation(async () => {
			return new Response("Unauthorized: invalid service account key", {
				status: 401,
			});
		});

		const provider = new OpenCodeProvider("invalid_key");
		await expect(
			provider.complete({
				system: "sys",
				messages: [{ role: "user", content: "Hello" }],
			}),
		).rejects.toThrow("OpenCode API error (401)");
	});
});
