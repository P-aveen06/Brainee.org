import {
	type AssistantRuntime,
	AssistantRuntimeProvider,
} from "@assistant-ui/react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import type { AssistantPageContext } from "@/lib/ai/page-context";
import {
	type InitialAssistantMessage,
	useAssistantUiBridge,
} from "./AssistantRuntimeAdapter";

export type AssistantSessionStatus = "running" | "complete" | "error";

interface Session {
	key: string;
	conversationId?: string;
	title?: string;
	initialMessages: InitialAssistantMessage[];
	pageContext?: AssistantPageContext;
	runtime?: AssistantRuntime;
	status?: AssistantSessionStatus;
}

interface SessionView {
	container: HTMLElement;
	content: ReactNode;
}

interface SessionsContext {
	sessions: Session[];
	ensureSession: (session: Session) => void;
	removeSession: (conversationId: string) => void;
	clearStatus: (idOrKey: string) => void;
	setView: (
		key: string,
		view: SessionView | undefined,
		previousContainer?: HTMLElement,
	) => void;
}

const Context = createContext<SessionsContext | null>(null);

function RuntimeHost({
	session,
	view,
	onRuntime,
	onCreated,
	onStatus,
}: {
	session: Session;
	view?: SessionView;
	onRuntime: (key: string, runtime: AssistantRuntime) => void;
	onCreated: (key: string, conversationId: string) => void;
	onStatus: (key: string, status: AssistantSessionStatus) => void;
}) {
	const handleCreated = useCallback(
		(id: string) => onCreated(session.key, id),
		[onCreated, session.key],
	);
	const { runtime } = useAssistantUiBridge(
		session.conversationId,
		session.initialMessages,
		handleCreated,
		session.pageContext,
	);
	useEffect(() => {
		onRuntime(session.key, runtime);
	}, [onRuntime, session.key, runtime]);
	const wasRunning = useRef(false);
	useEffect(
		() =>
			runtime.thread.subscribe(() => {
				const state = runtime.thread.getState();
				if (state.isRunning === wasRunning.current) return;
				wasRunning.current = state.isRunning;
				if (state.isRunning) {
					onStatus(session.key, "running");
					return;
				}
				const last = state.messages.at(-1);
				const failed =
					last?.role === "assistant" &&
					(last.status.type === "incomplete" ||
						last.content.some(
							(part) => part.type === "text" && part.text.includes("⚠️"),
						));
				onStatus(session.key, failed ? "error" : "complete");
			}),
		[runtime, session.key, onStatus],
	);
	return (
		<AssistantRuntimeProvider runtime={runtime}>
			{view && createPortal(view.content, view.container)}
		</AssistantRuntimeProvider>
	);
}

/** Runtime owners stay mounted across chat and application route changes. */
export function AssistantSessionsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [views, setViews] = useState<Record<string, SessionView | undefined>>(
		{},
	);
	const ensureSession = useCallback((session: Session) => {
		setSessions((current) => {
			const existing = current.find(
				(item) =>
					item.key === session.key ||
					(session.conversationId &&
						item.conversationId === session.conversationId),
			);
			if (!existing) return [...current, session];
			if (
				JSON.stringify(existing.pageContext) ===
				JSON.stringify(session.pageContext)
			) {
				return current;
			}
			return current.map((item) =>
				item === existing
					? { ...item, pageContext: session.pageContext }
					: item,
			);
		});
	}, []);
	const onRuntime = useCallback((key: string, runtime: AssistantRuntime) => {
		setSessions((current) =>
			current.map((item) => (item.key === key ? { ...item, runtime } : item)),
		);
	}, []);
	const onStatus = useCallback(
		(key: string, status: AssistantSessionStatus) => {
			setSessions((current) =>
				current.map((item) =>
					item.key === key && item.status !== status
						? { ...item, status }
						: item,
				),
			);
		},
		[],
	);
	const onCreated = useCallback((key: string, conversationId: string) => {
		setSessions((current) =>
			current.map((item) =>
				item.key === key
					? {
							...item,
							conversationId,
							title: item.runtime?.thread
								.getState()
								.messages.find((message) => message.role === "user")
								?.content.flatMap((part) =>
									part.type === "text" ? [part.text] : [],
								)
								.join("")
								.slice(0, 40),
						}
					: item,
			),
		);
	}, []);
	const removeSession = useCallback((conversationId: string) => {
		setSessions((current) =>
			current.filter((item) => item.conversationId !== conversationId),
		);
	}, []);
	const clearStatus = useCallback((idOrKey: string) => {
		setSessions((current) =>
			current.map((item) =>
				(item.key === idOrKey || item.conversationId === idOrKey) &&
				item.status !== undefined
					? { ...item, status: undefined }
					: item,
			),
		);
	}, []);
	const setView = useCallback(
		(
			key: string,
			view: SessionView | undefined,
			previousContainer?: HTMLElement,
		) => {
			setViews((current) => {
				if (previousContainer && current[key]?.container !== previousContainer)
					return current;
				if (current[key] === view) return current;
				return { ...current, [key]: view };
			});
		},
		[],
	);
	// Portal updates must not notify session consumers: route callbacks and their
	// rendered content can change identity each time those consumers render.
	const context = useMemo(
		() => ({ sessions, ensureSession, setView, removeSession, clearStatus }),
		[sessions, ensureSession, setView, removeSession, clearStatus],
	);
	return (
		<Context.Provider value={context}>
			{sessions.map((session) => (
				<RuntimeHost
					key={session.key}
					session={session}
					view={views[session.key]}
					onRuntime={onRuntime}
					onCreated={onCreated}
					onStatus={onStatus}
				/>
			))}
			{children}
		</Context.Provider>
	);
}

export function useAssistantSessionHistory() {
	const context = useContext(Context);
	if (!context) throw new Error("AssistantSessionsProvider is required.");
	return {
		statuses: Object.fromEntries(
			context.sessions.flatMap((session) =>
				session.conversationId && session.status
					? [[session.conversationId, session.status]]
					: [],
			),
		) as Record<string, AssistantSessionStatus>,
		conversations: context.sessions.flatMap((session) =>
			session.conversationId
				? [{ id: session.conversationId, title: session.title || null }]
				: [],
		),
		clearStatus: (id: string) => context.clearStatus(id),
		forgetConversation: (id: string) => {
			for (const session of context.sessions) {
				if (session.conversationId === id) session.runtime?.thread.cancelRun();
			}
			context.removeSession(id);
		},
	};
}

export function useAssistantSessionView(
	key: string | undefined,
	container: HTMLElement | null,
	content: ReactNode,
) {
	const context = useContext(Context);
	if (!context) throw new Error("AssistantSessionsProvider is required.");
	const { setView } = context;
	useEffect(() => {
		if (!key || !container) return;
		setView(key, { container, content });
		return () => setView(key, undefined, container);
	}, [key, container, content, setView]);
}

export function useAssistantSession(
	key: string,
	conversationId: string | undefined,
	initialMessages: InitialAssistantMessage[],
	pageContext?: AssistantPageContext,
) {
	const context = useContext(Context);
	if (!context) throw new Error("AssistantSessionsProvider is required.");
	const { sessions, ensureSession } = context;
	useEffect(() => {
		ensureSession({ key, conversationId, initialMessages, pageContext });
	}, [ensureSession, key, conversationId, initialMessages, pageContext]);
	return sessions.find(
		(item) =>
			item.key === key ||
			(conversationId && item.conversationId === conversationId),
	);
}
