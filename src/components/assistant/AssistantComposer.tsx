"use client";
import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { Mic, MicOff, Send, Square } from "lucide-react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { cn } from "@/lib/utils";

export function AssistantComposer() {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

	return (
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
							<Button
								type="button"
								onClick={stopListening}
								className="text-[11px] font-semibold underline hover:no-underline cursor-pointer"
							>
								Done
							</Button>
						</div>
					)}

					{/* Textarea - Auto-expanding up to 3 lines (max-h-[76px]), then scrollable */}
					<ComposerPrimitive.Input
						ref={textareaRef}
						rows={1}
						placeholder={isListening ? "Listening…" : "Ask Company Brain…"}
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

					{/* Bottom toolbar: Voice + Send right */}
					<div className="flex items-center justify-end pt-1.5 -mb-0.5">
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
	);
}
