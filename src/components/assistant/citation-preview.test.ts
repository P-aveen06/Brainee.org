// @vitest-environment jsdom
import {
	AssistantRuntimeProvider,
	ThreadPrimitive,
	useLocalRuntime,
} from "@assistant-ui/react";
import {
	act,
	cleanup,
	fireEvent,
	render,
	waitFor,
} from "@testing-library/react";
import { createElement as h } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { getTaskCitationDetails } from "@/api/ai-assistant-citations";
import { AssistantMessages } from "./AssistantMessages";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/api/ai-assistant-citations", () => ({
	getTaskCitationDetails: vi.fn(async () => ({
		description: "Detailed task evidence loaded asynchronously.",
		relatedTasks: [],
		relatedTasksRemaining: 0,
	})),
}));

function Harness() {
	const runtime = useLocalRuntime(
		{ run: async () => ({ content: [] }) },
		{
			initialMessages: [
				{
					role: "assistant",
					content: "Review the task. [PRJ-001 #1]",
					metadata: {
						custom: {
							citations: [
								{
									id: "task-1",
									type: "task",
									projectId: "PRJ-001",
									label: "PRJ-001 #1",
								},
							],
						},
					},
				},
			],
		},
	);
	return h(
		AssistantRuntimeProvider,
		{ runtime },
		h(ThreadPrimitive.Root, null, h(AssistantMessages)),
	);
}

afterEach(cleanup);

test("citation hover preview survives detail loading and parent renders", async () => {
	const view = render(h(Harness));
	await view.findByRole("link", { name: "View source details: PRJ-001 #1" });
	await act(async () => {});
	fireEvent.mouseEnter(
		view.getByRole("link", { name: "View source details: PRJ-001 #1" }),
	);
	fireEvent.mouseMove(
		view.getByRole("link", { name: "View source details: PRJ-001 #1" }),
	);
	await waitFor(() => expect(getTaskCitationDetails).toHaveBeenCalled());
	const link = view.getByRole("link", {
		name: "View source details: PRJ-001 #1",
	});
	await view.findByText("Detailed task evidence loaded asynchronously.");
	view.rerender(h(Harness));
	expect(
		view.getByRole("link", { name: "View source details: PRJ-001 #1" }),
	).toBe(link);
	expect(
		document.querySelector('[data-slot="tooltip-content"][data-open]'),
	).toBeTruthy();
	const preview = document.querySelector('[data-slot="tooltip-content"]');
	if (!preview) throw new Error("Citation preview missing");
	fireEvent.mouseLeave(link, { relatedTarget: preview });
	fireEvent.mouseEnter(preview, { relatedTarget: link });
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 450));
	});
	expect(preview.hasAttribute("data-open")).toBe(true);
	expect(getTaskCitationDetails).toHaveBeenCalledTimes(1);
});
