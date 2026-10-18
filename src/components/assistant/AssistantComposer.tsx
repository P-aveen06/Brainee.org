"use client";
import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { Mic, MicOff, Send, Square } from "lucide-react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { cn } from "@/lib/utils";

const MIN_TEXTAREA_HEIGHT = 36;
const MAX_TEXTAREA_HEIGHT = 104;

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
			textarea.style.height = `${Math.min(
				Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT),
				MAX_TEXTAREA_HEIGHT,
			)}px`;
		}
	}, []);

	// Grow the input for longer prompts, then let it scroll.
	const adjustTextareaHeight = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		const newHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
		el.style.height = `${Math.max(newHeight, MIN_TEXTAREA_HEIGHT)}px`;
		el.scrollTop = el.scrollHeight;
	}, []);

	const { isListening, isSupported, toggleListening, stopListening } =
		useSpeechToText({
			onTranscriptChange: handleTranscriptChange,
		});

	return (
		<div className="shrink-0 w-full bg-transparent px-4 pb-4 pt-1">
			<div className="mx-auto w-full max-w-5xl">
				{isListening && (
					<div
						role="status"
						aria-live="polite"
						className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive shadow-xs"
					>
						<div className="flex min-w-0 items-center gap-2">
							<span
								className="relative flex size-2 shrink-0"
								aria-hidden="true"
							>
								<span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-50" />
								<span className="relative size-2 rounded-full bg-destructive" />
							</span>
							<span className="truncate">Listening… speak clearly</span>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={stopListening}
							className="h-7 shrink-0 rounded-lg px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
						>
							Stop
						</Button>
					</div>
				)}
				<ComposerPrimitive.Root className="relative flex min-h-12 items-end gap-2 rounded-3xl border border-border/80 bg-card/90 px-6 py-3 shadow-sm backdrop-blur-xl transition-[border-color,box-shadow] focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10 dark:bg-card/75">
					{/* Textarea grows with longer prompts, then becomes scrollable. */}
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
						className="min-h-9 max-h-[104px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-2 font-sans text-base leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none scrollbar-thin"
					/>

					<div className="flex shrink-0 items-center gap-1 self-end pb-0.5">
						{isSupported && (
							<Button
								type="button"
								variant={isListening ? "destructive" : "ghost"}
								size="icon-xs"
								onClick={toggleListening}
								className={cn(
									"size-8 rounded-full transition-colors",
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
									className="size-8 shrink-0 rounded-full"
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
									className="size-8 shrink-0 rounded-full bg-primary text-primary-foreground shadow-2xs transition-colors hover:bg-primary/90"
									title="Send message"
								>
									<Send className="size-3.5" />
								</Button>
							</ComposerPrimitive.Send>
						</ThreadPrimitive.If>
					</div>
				</ComposerPrimitive.Root>
			</div>
		</div>
	);
}
