// @vitest-environment jsdom
import {
	AssistantRuntimeProvider,
	ComposerPrimitive,
	type ThreadMessageLike,
	ThreadPrimitive,
	useLocalRuntime,
} from "@assistant-ui/react";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { createElement as h } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantMessages } from "./AssistantMessages";
import { AssistantSuggestions } from "./AssistantSuggestions";

vi.mock("@tanstack/react-router", () => ({
	useRouteContext: () => ({
		user: { name: "Anika Shah", role: "user", authId: "sample:sample-anika" },
	}),
}));

const run = vi.fn(async () => ({
	content: [{ type: "text" as const, text: "Here is your update." }],
}));

function Harness({
	initialMessages = [],
}: {
	initialMessages?: ThreadMessageLike[];
}) {
	const runtime = useLocalRuntime({ run }, { initialMessages });
	return h(
		AssistantRuntimeProvider,
		{ runtime },
		h(
			ThreadPrimitive.Root,
			{},
			h(AssistantMessages),
			h(AssistantSuggestions, { welcome: true }),
			h(AssistantSuggestions),
			h(
				ComposerPrimitive.Root,
				{},
				h(ComposerPrimitive.Input, { "aria-label": "Message" }),
			),
		),
	);
}

afterEach(() => {
	cleanup();
	run.mockClear();
});

describe("assistant suggestions", () => {
	it("fills the composer from a starter prompt without sending", async () => {
		render(h(Harness));
		fireEvent.click(screen.getByRole("button", { name: /Start my day/ }));
		await waitFor(() =>
			expect(
				(screen.getByRole("textbox") as HTMLTextAreaElement).value,
			).toContain("Brief me on my assigned work"),
		);
		expect(run).not.toHaveBeenCalled();
	});

	it("shows relevant follow-ups on a saved chat and hides the model name", async () => {
		render(
			h(Harness, {
				initialMessages: [
					{ role: "user", content: "Who is on leave?" },
					{
						role: "assistant",
						content: "No one is on leave.",
						metadata: { custom: { modelId: "gpt-6-luna", latencyMs: 1200 } },
					},
				],
			}),
		);
		expect(screen.queryByText("gpt-6-luna")).toBeNull();
		expect(
			screen.queryByRole("region", { name: "Suggested prompts" }),
		).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "Show my pending leave requests" }),
		);
		await waitFor(() =>
			expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
				"Show my pending leave requests",
			),
		);
		expect(run).not.toHaveBeenCalled();
	});

	it("does not offer follow-ups after a failed response", () => {
		render(
			h(Harness, {
				initialMessages: [
					{ role: "user", content: "Show my projects" },
					{ role: "assistant", content: "⚠️ Timeout: Please retry." },
				],
			}),
		);
		expect(
			screen.queryByRole("region", { name: "Suggested follow-ups" }),
		).toBeNull();
	});
});
