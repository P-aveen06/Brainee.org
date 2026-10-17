"use client";

import { useLocation, useNavigate } from "@tanstack/react-router";
import { Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { deriveAssistantPageContext } from "@/lib/ai/page-context";
import { cn } from "@/lib/utils";
import { AssistantPane } from "./AssistantPane";

export function GlobalBrainDrawer() {
	const [isOpen, setIsOpen] = useState(false);
	const [activeConversationId, setActiveConversationId] = useState<
		string | undefined
	>(undefined);
	const location = useLocation();
	const navigate = useNavigate();
	const pageContext = deriveAssistantPageContext(location.pathname);
	const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
	const wasSidebarOpenRef = useRef<boolean>(false);
	const prevIsOpenRef = useRef(isOpen);

	// Global Cmd+J / Ctrl+J hotkey and Escape to close
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
				e.preventDefault();
				setIsOpen((prev) => !prev);
			} else if (e.key === "Escape" && isOpen) {
				setIsOpen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen]);

	// Auto-close sidebar while drawer is open, restore when closed
	useEffect(() => {
		const prev = prevIsOpenRef.current;
		prevIsOpenRef.current = isOpen;

		if (!prev && isOpen) {
			wasSidebarOpenRef.current = sidebarOpen;
			if (sidebarOpen) {
				setSidebarOpen(false);
			}
		} else if (prev && !isOpen) {
			if (wasSidebarOpenRef.current) {
				setSidebarOpen(true);
				wasSidebarOpenRef.current = false;
			}
		}
	}, [isOpen, sidebarOpen, setSidebarOpen]);

	// If user is already on the dedicated full-page /assistant, hide the floating widget
	const isAssistantPage = location.pathname.startsWith("/assistant");
	if (isAssistantPage) {
		return null;
	}

	// Detect current page context
	let contextLabel = "";
	if (location.pathname.startsWith("/projects/")) {
		const parts = location.pathname.split("/");
		const id = parts[2];
		contextLabel = id ? id.toUpperCase() : "Projects";
	} else if (location.pathname.startsWith("/calendar")) {
		contextLabel = "Calendar";
	} else if (location.pathname.startsWith("/team-calendar")) {
		contextLabel = "Team OOO";
	} else if (location.pathname.startsWith("/my-tasks")) {
		contextLabel = "Tasks";
	} else if (location.pathname.startsWith("/admin")) {
		contextLabel = "Admin";
	}

	const handleOpenFullScreen = () => {
		setIsOpen(false);
		navigate({
			to: "/assistant",
			search: activeConversationId ? { thread: activeConversationId } : {},
		});
	};

	return (
		<>
			{/* Floating Chat Window (Not a side panel) */}
			{/* Kept mounted while closed: the assistant runtime seeds its message list once at
			    mount, so unmounting on close reopens an empty thread over a live conversation. */}
			<div
				className={cn(
					"fixed bottom-18 right-5 z-50 h-[540px] max-h-[calc(100vh-5.5rem)] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-150",
					isOpen ? "flex animate-in fade-in zoom-in-95" : "hidden",
				)}
				role="dialog"
				aria-label="Company Brain Chat Window"
			>
				{/* Window Header */}
				<div className="flex h-10 shrink-0 select-none items-center justify-between border-b border-border bg-card px-3">
					<div className="flex items-center gap-2 min-w-0">
						<img
							src="/brainee-logo.svg"
							alt="Brainee.org"
							className="size-4.5 object-contain shrink-0"
						/>
						<span className="font-heading text-xs font-semibold text-foreground truncate">
							Company Brain
						</span>
						{contextLabel && (
							<span className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/50 truncate">
								{contextLabel}
							</span>
						)}
					</div>

					<div className="flex items-center gap-0.5">
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={handleOpenFullScreen}
							className="size-6 text-muted-foreground hover:text-foreground"
							title="Open full page"
						>
							<Maximize2 className="size-3" />
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={() => setIsOpen(false)}
							className="size-6 text-muted-foreground hover:text-foreground"
							title="Minimize"
						>
							<X className="size-3.5" />
						</Button>
					</div>
				</div>

				{/* Assistant Runtime Content - showHeader={false} eliminates duplicate header */}
				<div className="flex-1 min-h-0 flex flex-col bg-background">
					<AssistantPane
						conversationId={activeConversationId}
						initialMessages={[]}
						showHeader={false}
						onConversationCreated={(id) => setActiveConversationId(id)}
						onProposalResolved={() => {}}
						pageContext={pageContext}
					/>
				</div>
			</div>

			{/* Floating Trigger Button with Brainee.org Logo */}
			<button
				type="button"
				onClick={() => setIsOpen((prev) => !prev)}
				className={`fixed bottom-5 right-5 z-50 flex size-11 items-center justify-center rounded-full shadow-lg transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ${
					isOpen
						? "bg-card border border-border text-foreground shadow-md hover:bg-surface-alt"
						: "bg-card border border-border shadow-md hover:bg-surface-alt hover:border-accent/40"
				}`}
				title={isOpen ? "Close Company Brain (Esc)" : "Open Company Brain (⌘J)"}
				aria-label={isOpen ? "Close Company Brain" : "Open Company Brain"}
			>
				{isOpen ? (
					<X className="size-4.5 text-foreground" />
				) : (
					<img
						src="/brainee-logo.svg"
						alt="Brainee.org"
						className="size-6 object-contain"
					/>
				)}
			</button>
		</>
	);
}
