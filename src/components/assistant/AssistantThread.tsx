"use client";

import {
	ComposerPrimitive,
	MessagePrimitive,
	ThreadPrimitive,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import {
	AlertCircle,
	Check,
	ChevronDown,
	Copy,
	Mic,
	MicOff,
	PanelLeftClose,
	Send,
	Square,
	Zap,
} from "lucide-react";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { cn } from "@/lib/utils";
import { AssistantEmptyState } from "./AssistantEmptyState";
import type { MessageCustomData } from "./AssistantRuntimeAdapter";
import { CitationChips } from "./CitationChips";
import { ProposedActionCard } from "./ProposedActionCard";
import { ScopeNotice } from "./ScopeNotice";

const MODEL_OPTIONS = [
	{
		id: "DeepSeek-V4-Flash",
		label: "DeepSeek V4 Flash",
		provider: "Azure",
		badge: "Default",
	},
	{
		id: "google/gemini-2.5-flash",
		label: "Gemini 2.5 Flash",
		provider: "OpenRouter",
		badge: null,
	},
	{
		id: "google/gemini-2.5-pro",
		label: "Gemini 2.5 Pro",
		provider: "OpenRouter",
		badge: "Pro",
	},
	{
		id: "openai/gpt-4o-mini",
		label: "GPT-4o Mini",
		provider: "OpenRouter",
		badge: null,
	},
	{
		id: "anthropic/claude-3.5-sonnet",
		label: "Claude 3.5 Sonnet",
		provider: "OpenRouter",
		badge: null,
	},
] as const;

interface AssistantThreadProps {
	threadTitle?: string;
	showHeader?: boolean;
	onProposalResolved?: () => void;
	onToggleSidebar?: () => void;
	sidebarOpen?: boolean;
	userRole?: string;
	projectCount?: number;
	modelIdRef?: MutableRefObject<string | undefined>;
}

export function AssistantThread({
	threadTitle,
	showHeader = true,
	onProposalResolved,
	onToggleSidebar,
	sidebarOpen = true,
	userRole,
	projectCount,
	modelIdRef,
}: AssistantThreadProps) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [selectedModelId, setSelectedModelId] = useState<
		(typeof MODEL_OPTIONS)[number]["id"]
	>(MODEL_OPTIONS[0].id);
	const [modelMenuOpen, setModelMenuOpen] = useState(false);
	const modelMenuRef = useRef<HTMLDivElement | null>(null);

	// Sync ref so the runtime adapter reads the latest selection at send time
	useEffect(() => {
		if (modelIdRef) {
			modelIdRef.current = selectedModelId;
		}
	}, [selectedModelId, modelIdRef]);

	// Close model menu on outside click
	useEffect(() => {
		if (!modelMenuOpen) return;
		const handler = (e: MouseEvent) => {
			if (
				modelMenuRef.current &&
				!modelMenuRef.current.contains(e.target as Node)
			) {
				setModelMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [modelMenuOpen]);

	const selectedModel =
		MODEL_OPTIONS.find((m) => m.id === selectedModelId) || MODEL_OPTIONS[0];

	// Voice dictation handler
	const handleTranscriptChange = useCallback((text: string) => {
		const textarea = textareaRef.current;
		if (textarea && text) {
			const nativeValueSetter = Object.getOwnPropertyDescriptor(
				window.HTMLTextAreaElement.prototype,
				"value",
			)?.set;
			nativeValueSetter?.call(textarea, text);
			textarea.dispatchEvent(new Event("input", { bubbles: true }));
			textarea.focus();
			// Auto-grow
			textarea.style.height = "auto";
			textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 28), 76)}px`;
		}
	}, []);

	// Auto-adjust height up to 3 lines (~76px), then let it scroll
	const adjustTextareaHeight = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		const newHeight = Math.min(el.scrollHeight, 76);
		el.style.height = `${Math.max(newHeight, 28)}px`;
	}, []);

	const { isListening, isSupported, toggleListening, stopListening } =
		useSpeechToText({
			onTranscriptChange: handleTranscriptChange,
		});

	const handleCopy = (id: string, text: string) => {
		navigator.clipboard.writeText(text);
		setCopiedId(id);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopiedId(null), 2000);
	};

	return (
		<ThreadPrimitive.Root className="flex h-full min-w-0 flex-col bg-background">
			{/* Header Bar */}
			{showHeader && (
				<header className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 bg-transparent px-4">
					<div className="flex items-center gap-2 min-w-0">
						{onToggleSidebar && !sidebarOpen && (
							<Button
								variant="ghost"
								size="icon-xs"
								onClick={onToggleSidebar}
								className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-alt -ml-1 mr-0.5"
								title="Open chats"
							>
								<PanelLeftClose className="size-3.5 rotate-180" />
							</Button>
						)}
						<span className="text-xs font-semibold text-foreground truncate tracking-tight">
							{threadTitle || "Brainee.org Brain"}
						</span>
					</div>

					<div className="flex items-center gap-3">
						{userRole && (
							<ScopeNotice userRole={userRole} projectCount={projectCount} />
						)}
					</div>
				</header>
			)}

			{/* Scrollable Message Viewport */}
			<ThreadPrimitive.Viewport className="flex-1 overflow-y-auto scrollbar-thin">
				<ThreadPrimitive.Empty>
					<AssistantEmptyState />
				</ThreadPrimitive.Empty>

				<div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-8">
					<ThreadPrimitive.Messages>
						{({ message }) => {
							const isUser = message.role === "user";
							const custom = (message.metadata?.custom ||
								{}) as Partial<MessageCustomData>;

							// Extract raw text for copying
							let rawText = "";
							if (Array.isArray(message.content)) {
								for (const part of message.content) {
									if (part.type === "text") rawText += part.text;
								}
							} else if (typeof message.content === "string") {
								rawText = message.content;
							}

							const isFailure =
								rawText.startsWith("⚠️ Error:") ||
								rawText.startsWith("⚠️ Connection Error:") ||
								rawText.startsWith("⚠️ Timeout:") ||
								rawText.startsWith("⚠️ Interrupted:") ||
								rawText.startsWith("⚠️ Service Error:");

							if (isUser) {
								return (
									<MessagePrimitive.Root
										key={message.id}
										className="flex justify-end"
									>
										<div className="max-w-[82%] min-w-0">
											<div className="rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 px-4 py-2.5 shadow-xs text-sm leading-relaxed font-sans select-text">
												<MessagePrimitive.Parts
													components={{
														Text: () => <MarkdownTextPrimitive />,
													}}
												/>
											</div>
										</div>
									</MessagePrimitive.Root>
								);
							}

							const isGenerating =
								!rawText.trim() &&
								(!custom.proposals || custom.proposals.length === 0);

							if (isGenerating) {
								return (
									<MessagePrimitive.Root
										key={message.id}
										className="flex items-start gap-2.5 w-full min-w-0 animate-in fade-in duration-150"
									>
										<div className="size-6 shrink-0 flex items-center justify-center mt-0.5 animate-pulse">
											<img
												src="/brainee-logo.svg"
												alt="Brainee.org"
												className="size-5 object-contain"
											/>
										</div>
										<div className="flex-1 min-w-0 space-y-1.5">
											<div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-0.5">
												<span className="font-semibold text-foreground">
													Brainee.org Brain
												</span>
												<span className="font-mono text-[10px] text-accent animate-pulse">
													Thinking…
												</span>
											</div>
											<div className="rounded-2xl rounded-tl-xs border border-border/70 bg-card p-3 space-y-2 max-w-sm shadow-xs">
												<div className="h-2 bg-muted rounded-full w-5/6 animate-pulse" />
												<div className="h-2 bg-muted rounded-full w-3/5 animate-pulse" />
											</div>
										</div>
									</MessagePrimitive.Root>
								);
							}

							return (
								<MessagePrimitive.Root
									key={message.id}
									className="group flex items-start gap-2.5 w-full min-w-0"
								>
									{/* Brain Avatar */}
									<div className="size-6 shrink-0 flex items-center justify-center mt-0.5">
										<img
											src="/brainee-logo.svg"
											alt="Brainee.org"
											className="size-5 object-contain"
										/>
									</div>

									{/* Content Area */}
									<div className="flex-1 min-w-0 space-y-1.5">
										{/* Assistant Meta Header */}
										<div className="flex items-center justify-between pb-0.5">
											<div className="flex items-center gap-1.5 flex-wrap">
												<span className="text-xs font-semibold text-foreground tracking-tight">
													Brainee.org Brain
												</span>
												{custom.modelId && (
													<span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.2 rounded border border-accent/20 font-mono">
														{custom.modelId.replace(/^.*\//, "")}
													</span>
												)}
												{custom.latencyMs !== undefined && (
													<span className="text-[10px] font-mono text-muted-foreground bg-surface-alt px-1.5 py-0.2 rounded border border-border/50">
														⚡ {(custom.latencyMs / 1000).toFixed(1)}s
													</span>
												)}
											</div>

											<Button
												variant="ghost"
												size="icon-xs"
												className="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
												onClick={() => handleCopy(message.id, rawText)}
												title="Copy response"
											>
												{copiedId === message.id ? (
													<Check className="size-3 text-emerald-600" />
												) : (
													<Copy className="size-3" />
												)}
											</Button>
										</div>

										{/* Failure State vs Normal Markdown Bubble */}
										{isFailure ? (
											<div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive space-y-1 shadow-xs">
												<div className="flex items-center gap-1.5 font-semibold">
													<AlertCircle className="size-3.5 shrink-0" />
													<span>Unable to complete response</span>
												</div>
												<p className="text-muted-foreground leading-relaxed pl-5">
													{rawText.replace(/^⚠️\s*/, "")}
												</p>
											</div>
										) : (
											<div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs text-xs sm:text-sm leading-relaxed text-foreground">
												<div className="assistant-prose prose prose-sm dark:prose-invert max-w-none">
													<MessagePrimitive.Parts
														components={{
															Text: () => <MarkdownTextPrimitive />,
														}}
													/>
												</div>
											</div>
										)}

										{/* Grounded Citation Chips */}
										{custom.citations && custom.citations.length > 0 && (
											<div className="pt-0.5">
												<CitationChips citations={custom.citations} />
											</div>
										)}

										{/* Proposed Action Cards */}
										{custom.proposals && custom.proposals.length > 0 && (
											<div className="pt-1 space-y-1.5">
												{custom.proposals.map((prop) => (
													<ProposedActionCard
														key={prop.id}
														action={prop}
														onActionResolved={onProposalResolved}
													/>
												))}
											</div>
										)}
									</div>
								</MessagePrimitive.Root>
							);
						}}
					</ThreadPrimitive.Messages>
				</div>
			</ThreadPrimitive.Viewport>

			{/* Composer Area - ChatGPT style with model selector at bottom-left */}
			<div className="shrink-0 w-full px-4 pb-4 pt-1 bg-transparent">
				<div className="mx-auto w-full max-w-4xl">
					<ComposerPrimitive.Root className="relative flex flex-col rounded-2xl border border-border/80 bg-card px-3.5 py-2 shadow-xs transition-all focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-primary/10">
						{/* Voice Listening Active Banner (Overlaid inside capsule) */}
						{isListening && (
							<div className="absolute -top-9 left-2 right-2 flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1 text-xs text-red-600 dark:text-red-400 backdrop-blur-md shadow-xs animate-pulse">
								<div className="flex items-center gap-1.5">
									<span className="size-1.5 rounded-full bg-red-500 animate-ping" />
									<span className="font-medium text-[11px]">
										Listening… speak clearly
									</span>
								</div>
								<button
									type="button"
									onClick={stopListening}
									className="text-[11px] font-semibold underline hover:no-underline cursor-pointer"
								>
									Done
								</button>
							</div>
						)}

						{/* Textarea - Auto-expanding up to 3 lines (max-h-[76px]), then scrollable */}
						<ComposerPrimitive.Input
							ref={textareaRef}
							rows={1}
							placeholder={isListening ? "Listening…" : "Ask Brainee.org Brain…"}
							onInput={adjustTextareaHeight}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									setTimeout(() => {
										if (textareaRef.current) {
											textareaRef.current.style.height = "auto";
										}
									}, 0);
								}
							}}
							className="min-h-[28px] max-h-[76px] w-full resize-none bg-transparent py-1 font-sans text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none scrollbar-thin leading-relaxed"
						/>

						{/* Bottom toolbar: Model selector left, Voice + Send right */}
						<div className="flex items-center justify-between pt-1.5 -mb-0.5">
							{/* Model Selector - Bottom Left */}
							<div className="relative" ref={modelMenuRef}>
								<button
									type="button"
									onClick={() => setModelMenuOpen((p) => !p)}
									className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-alt transition-colors cursor-pointer"
								>
									<Zap className="size-3 text-accent" />
									<span className="truncate max-w-[120px]">
										{selectedModel.label}
									</span>
									<ChevronDown
										className={cn(
											"size-3 transition-transform",
											modelMenuOpen && "rotate-180",
										)}
									/>
								</button>

								{/* Dropdown Menu - Opens upward */}
								{modelMenuOpen && (
									<div className="absolute bottom-full left-0 mb-1.5 w-56 rounded-xl border border-border/80 bg-card shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
										<div className="px-3 py-2 border-b border-border/50">
											<span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
												Select Model
											</span>
										</div>
										<div className="py-1">
											{MODEL_OPTIONS.map((model) => (
												<button
													key={model.id}
													type="button"
													onClick={() => {
														setSelectedModelId(model.id);
														setModelMenuOpen(false);
													}}
													className={cn(
														"w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors cursor-pointer",
														selectedModelId === model.id
															? "bg-primary/8 text-foreground"
															: "text-muted-foreground hover:bg-surface-alt hover:text-foreground",
													)}
												>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5">
															<span className="font-medium truncate">
																{model.label}
															</span>
															{model.badge && (
																<span
																	className={cn(
																		"text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
																		model.badge === "Default"
																			? "bg-accent/15 text-accent"
																			: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
																	)}
																>
																	{model.badge}
																</span>
															)}
														</div>
														<span className="text-[10px] text-muted-foreground">
															via {model.provider}
														</span>
													</div>
													{selectedModelId === model.id && (
														<Check className="size-3.5 text-accent shrink-0" />
													)}
												</button>
											))}
										</div>
									</div>
								)}
							</div>

							{/* Right End Actions: Voice Dictation & Send/Stop Buttons */}
							<div className="flex items-center gap-1 shrink-0">
								{/* Voice-to-Text Button */}
								{isSupported && (
									<Button
										type="button"
										variant={isListening ? "destructive" : "ghost"}
										size="icon-xs"
										onClick={toggleListening}
										className={cn(
											"size-8 rounded-xl transition-all",
											isListening
												? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
												: "text-muted-foreground hover:text-foreground hover:bg-surface-alt",
										)}
										title={isListening ? "Stop listening" : "Voice dictation"}
									>
										{isListening ? (
											<MicOff className="size-4" />
										) : (
											<Mic className="size-4" />
										)}
									</Button>
								)}

								<ThreadPrimitive.If running>
									<ComposerPrimitive.Cancel asChild>
										<Button
											size="icon-xs"
											variant="destructive"
											className="size-8 rounded-xl shrink-0"
											title="Stop generation"
										>
											<Square className="size-3 fill-current" />
										</Button>
									</ComposerPrimitive.Cancel>
								</ThreadPrimitive.If>
								<ThreadPrimitive.If running={false}>
									<ComposerPrimitive.Send asChild>
										<Button
											size="icon-xs"
											onClick={() => {
												setTimeout(() => {
													if (textareaRef.current) {
														textareaRef.current.style.height = "auto";
													}
												}, 0);
											}}
											className="size-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 shadow-2xs"
											title="Send message"
										>
											<Send className="size-3.5" />
										</Button>
									</ComposerPrimitive.Send>
								</ThreadPrimitive.If>
							</div>
						</div>
					</ComposerPrimitive.Root>
				</div>
			</div>
		</ThreadPrimitive.Root>
	);
}
