import { describe, expect, it } from "vitest";
import { AssistantFailure, classifyAssistantFailure } from "./ai-errors";
import { completeWithinDeadline } from "./completion-timeout";
import type { ChatProvider } from "./provider";

describe("assistant completion timeouts", () => {
	it("fails a non-responsive provider at the remaining turn deadline", async () => {
		const provider: ChatProvider = {
			complete: () => new Promise(() => undefined),
		};

		await expect(
			completeWithinDeadline(
				provider,
				{ system: "test", messages: [] },
				Date.now() + 10,
			),
		).rejects.toMatchObject({ code: "turn_timeout" });
	});

	it("returns an immediately expired turn as a typed timeout", async () => {
		const provider: ChatProvider = {
			complete: () => new Promise(() => undefined),
		};

		await expect(
			completeWithinDeadline(
				provider,
				{ system: "test", messages: [] },
				Date.now() - 1,
			),
		).rejects.toMatchObject({ code: "turn_timeout" });
	});
});

describe("classifyAssistantFailure", () => {
	it("preserves a safe timeout message and code", () => {
		const result = classifyAssistantFailure(
			new AssistantFailure("provider_timeout", "Provider timed out."),
		);
		expect(result).toEqual({
			code: "provider_timeout",
			label: "Timeout",
			publicMessage: "Provider timed out.",
		});
	});

	it("does not expose unexpected internal errors", () => {
		const result = classifyAssistantFailure(
			new Error("secret upstream response"),
		);
		expect(result.code).toBe("turn_failed");
		expect(result.publicMessage).not.toContain("secret upstream response");
	});
});
