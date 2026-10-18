// @vitest-environment jsdom
import { type AssistantRuntime, useAuiState } from "@assistant-ui/react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createElement, useEffect, useMemo, useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { sendAiMessage } from "@/api/ai-assistant";
import { AssistantLoading } from "./AssistantLoading";
import { AssistantPane } from "./AssistantPane";
import {
	AssistantSessionsProvider,
	useAssistantSession,
	useAssistantSessionHistory,
	useAssistantSessionView,
} from "./AssistantSessions";
import { ConversationList } from "./ConversationList";

vi.mock("@/api/ai-assistant", () => ({ sendAiMessage: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("./AssistantThread", () => ({
	AssistantThread: () => createElement(Answer),
}));

const emptyMessages: [] = [];
const runtimes = new Map<string, AssistantRuntime>();

function History() {
	const { conversations, statuses } = useAssistantSessionHistory();
	return createElement(ConversationList, {
		conversations,
		statuses,
		onSelect: () => {},
		onNewChat: () => {},
	});
}

function Answer() {
	const messages = useAuiState((s) => s.thread.messages);
	const part = messages.at(-1)?.content[0];
	return createElement(
		"div",
		null,
		createElement("span", null, part?.type === "text" ? part.text : ""),
		createElement(AssistantLoading),
	);
}

function View({
	id,
	conversationId,
	observeOnly,
}: {
	id: string;
	conversationId?: string;
	observeOnly?: boolean;
}) {
	const session = useAssistantSession(id, conversationId, emptyMessages);
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const content = useMemo(() => createElement(Answer), []);
	useAssistantSessionView(
		session?.key,
		observeOnly ? null : container,
		content,
	);
	useEffect(() => {
		if (session?.runtime) runtimes.set(id, session.runtime);
	}, [id, session?.runtime]);
	return observeOnly ? null : createElement("div", { ref: setContainer });
}

afterEach(() => {
	cleanup();
	runtimes.clear();
	vi.clearAllMocks();
});

test("route callbacks can change without view registration triggering a render loop", async () => {
	let renders = 0;
	function RouteView({ title }: { title: string }) {
		useAssistantSessionHistory();
		renders++;
		if (renders > 30) throw new Error("Session view registration loop");
		return createElement(AssistantPane, {
			sessionKey: "new-route",
			conversationId: undefined,
			initialMessages: [],
			threadTitle: title,
			pageContext: { routeId: "/assistant", screen: "assistant" },
			onConversationCreated: () => {},
			onProposalResolved: () => {},
			onToggleSidebar: () => {},
		});
	}
	const tree = (title: string) =>
		createElement(
			AssistantSessionsProvider,
			null,
			createElement(RouteView, { title }),
		);
	const view = render(tree("First title"));
	await waitFor(() =>
		expect(view.container.querySelector("span")).toBeTruthy(),
	);
	view.rerender(tree("Changed title"));
	expect(renders).toBeLessThan(30);
});

test("concurrent streams survive replacing views and leaving the assistant page", async () => {
	const requests: {
		id: string;
		signal: AbortSignal;
		controller: ReadableStreamDefaultController<Uint8Array>;
	}[] = [];
	vi.mocked(sendAiMessage).mockImplementation(async (options) => {
		if (!options?.data) throw new Error("Expected message data");
		const { signal } = options;
		const data = options.data as { conversationId?: string };
		if (!signal) throw new Error("Expected a request abort signal");
		const id = data.conversationId || `conversation-${requests.length}`;
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				requests.push({ id, signal, controller });
			},
		});
		return { conversationId: id, stream } as never;
	});
	const tree = (id?: string, conversationId?: string) =>
		createElement(
			AssistantSessionsProvider,
			null,
			id ? createElement(View, { key: id, id, conversationId }) : null,
			createElement(History),
		);
	const view = render(tree("draft-a"));
	await waitFor(() => expect(runtimes.has("draft-a")).toBe(true));
	const first = runtimes.get("draft-a");
	if (!first) throw new Error("First runtime missing");
	act(() => first.thread.append("First question"));
	await waitFor(() => expect(requests).toHaveLength(1));
	await waitFor(() =>
		expect(view.getByText("Generating your response…")).toBeTruthy(),
	);
	expect(view.getByText("Running")).toBeTruthy();

	view.rerender(tree("draft-b"));
	await waitFor(() => expect(runtimes.has("draft-b")).toBe(true));
	const second = runtimes.get("draft-b");
	if (!second) throw new Error("Second runtime missing");
	act(() => second.thread.append("Second question"));
	await waitFor(() => expect(requests).toHaveLength(2));
	view.rerender(tree()); // Another application route, without any chat view.
	expect(view.queryByText("Generating your response…")).toBeNull();
	expect(view.getAllByText("Running")).toHaveLength(2);
	expect(view.getByText("First question")).toBeTruthy();
	expect(view.getByText("Second question")).toBeTruthy();
	expect(first.thread.getState().isRunning).toBe(true);
	expect(second.thread.getState().isRunning).toBe(true);
	for (const request of requests) expect(request.signal.aborted).toBe(false);
	view.rerender(tree("saved-a", requests[0].id));
	await waitFor(() => expect(runtimes.get("saved-a")).toBe(first));
	expect(first.thread.getState().isRunning).toBe(true);
	view.rerender(tree());

	act(() => {
		for (const request of requests) {
			request.controller.enqueue(
				new TextEncoder().encode(
					`${JSON.stringify({ type: "result", result: { content: `Answer ${request.id}` } })}\n`,
				),
			);
			request.controller.close();
		}
	});
	await waitFor(() => expect(first.thread.getState().isRunning).toBe(false));
	await waitFor(() => expect(second.thread.getState().isRunning).toBe(false));
	await waitFor(() => expect(view.getAllByText("Ready")).toHaveLength(2));

	view.rerender(tree("saved-a", requests[0].id));
	await waitFor(() => expect(runtimes.get("saved-a")).toBe(first));
	await waitFor(() =>
		expect(view.getByText("Answer conversation-0")).toBeTruthy(),
	);
	expect(view.queryByText("Generating your response…")).toBeNull();
	expect(first.thread.getState().messages.at(-1)?.content).toEqual([
		{ type: "text", text: "Answer conversation-0" },
	]);
	expect(second.thread.getState().messages.at(-1)?.content).toEqual([
		{ type: "text", text: "Answer conversation-1" },
	]);

	act(() => first.thread.append("Follow up"));
	await waitFor(() => expect(requests).toHaveLength(3));
	expect(requests[2].id).toBe(requests[0].id);
	act(() => second.thread.append("Another follow up"));
	await waitFor(() => expect(requests).toHaveLength(4));
	act(() => first.thread.cancelRun());
	await waitFor(() => expect(requests[2].signal.aborted).toBe(true));
	await waitFor(() => expect(view.getByText("Stopped")).toBeTruthy());
	expect(view.getByText("Running")).toBeTruthy();
	expect(requests[3].signal.aborted).toBe(false);
	expect(second.thread.getState().isRunning).toBe(true);
	act(() => {
		requests[3].controller.enqueue(
			new TextEncoder().encode(
				`${JSON.stringify({ type: "result", result: { content: "Still running independently" } })}\n`,
			),
		);
		requests[3].controller.close();
	});
	await waitFor(() => expect(second.thread.getState().isRunning).toBe(false));
});

test("a new chat acknowledged after navigation cannot redirect the active view", async () => {
	let acknowledge: ((response: unknown) => void) | undefined;
	let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	let requestSignal: AbortSignal | undefined;
	vi.mocked(sendAiMessage).mockImplementation((options) => {
		requestSignal = options?.signal;
		return new Promise((resolve) => {
			acknowledge = (response) => resolve(response as never);
		});
	});
	const onCreated = vi.fn();
	const props = {
		initialMessages: emptyMessages,
		onConversationCreated: onCreated,
		onProposalResolved: () => {},
	};
	const tree = (sessionKey: string, conversationId?: string) =>
		createElement(
			AssistantSessionsProvider,
			null,
			createElement(AssistantPane, {
				...props,
				key: sessionKey,
				sessionKey,
				conversationId,
			}),
		);
	// Use an existing runtime to observe registration without mounting a second view
	// on the draft's portal target.
	const draftTree = createElement(
		AssistantSessionsProvider,
		null,
		createElement(View, { id: "draft-late", observeOnly: true }),
		createElement(AssistantPane, {
			...props,
			sessionKey: "draft-late",
			conversationId: undefined,
		}),
	);
	const view = render(draftTree);
	await waitFor(() => expect(runtimes.has("draft-late")).toBe(true));
	const runtime = runtimes.get("draft-late");
	if (!runtime) throw new Error("Draft runtime missing");
	act(() => runtime.thread.append("A slow acknowledgement"));
	await waitFor(() => expect(acknowledge).toBeTypeOf("function"));
	view.rerender(tree("another-draft"));
	await act(async () => {
		acknowledge?.({
			conversationId: "saved-late",
			stream: new ReadableStream<Uint8Array>({
				start(value) {
					controller = value;
				},
			}),
		});
	});
	expect(requestSignal?.aborted).toBe(false);
	expect(onCreated).not.toHaveBeenCalled();
	act(() => {
		controller?.enqueue(
			new TextEncoder().encode(
				`${JSON.stringify({ type: "result", result: { content: "Background answer" } })}\n`,
			),
		);
		controller?.close();
	});
	await waitFor(() => expect(runtime.thread.getState().isRunning).toBe(false));
	view.rerender(tree("saved-late", "saved-late"));
	await waitFor(() => expect(view.getByText("Background answer")).toBeTruthy());
	expect(sendAiMessage).toHaveBeenCalledTimes(1);
});
