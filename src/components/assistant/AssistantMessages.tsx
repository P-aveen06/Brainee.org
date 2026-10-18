"use client";
import {
	MessagePrimitive,
	ThreadPrimitive,
	useAui,
	useAuiState,
} from "@assistant-ui/react";
import { AlertCircle, Check, Copy, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	ASSISTANT_ACTIVITY_LABELS,
	ASSISTANT_TOOL_STEP_LABELS,
} from "@/lib/ai/assistant-activity";
import { isAssistantChartSpec } from "@/lib/ai/chart-types";
import { AssistantChartLoader } from "./AssistantChartLoader";
import { assistantMessagePartComponents } from "./AssistantMarkdown";
import { AssistantQuestionCard } from "./AssistantQuestionCard";
import type { MessageCustomData } from "./AssistantRuntimeAdapter";
import { AssistantToolProgress } from "./AssistantToolProgress";
import { CitationChips } from "./CitationChips";
import { uniqueCitations } from "./citation-markers";
import { PitchResponseAttachments } from "./PitchResponseAttachments";
import { ProposedActionCard } from "./ProposedActionCard";

export function AssistantMessages({
	onProposalResolved,
}: {
	onProposalResolved?: () => void;
}) {
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const aui = useAui();
	const threadMessages = useAuiState((state) => state.thread.messages);
	const isThreadRunning = useAuiState((state) => state.thread.isRunning);
	const handleCopy = (id: string, text: string) => {
		navigator.clipboard.writeText(text);
		setCopiedId(id);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopiedId(null), 2000);
	};

	return (
		<ThreadPrimitive.Messages>
			{({ message }) => {
				const isUser = message.role === "user";
				const custom = (message.metadata?.custom ||
					{}) as Partial<MessageCustomData>;
				const citations = uniqueCitations(custom.citations ?? []);

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
							className="group flex justify-end"
						>
							<div className="relative max-w-[82%] min-w-0">
								<Button
									variant="ghost"
									size="icon-xs"
									className="absolute -left-8 top-1 size-6 text-muted-foreground hover:text-foreground"
									onClick={() => handleCopy(message.id, rawText)}
									title="Copy question"
									aria-label={
										copiedId === message.id
											? "Question copied"
											: "Copy question"
									}
								>
									{copiedId === message.id ? (
										<Check className="size-3 text-emerald-600" />
									) : (
										<Copy className="size-3" />
									)}
								</Button>
								<div className="assistant-message-text rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 px-4 py-2.5 shadow-xs font-sans select-text">
									<MessagePrimitive.Parts
										components={assistantMessagePartComponents}
									/>
								</div>
							</div>
						</MessagePrimitive.Root>
					);
				}

				const isGenerating =
					!rawText.trim() &&
					!custom.pitches?.length &&
					(!custom.proposals || custom.proposals.length === 0);
				const currentToolStep = custom.toolSteps?.find(
					(step) => step.status === "running",
				);

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
								<output
									aria-live="polite"
									aria-atomic="true"
									className="flex items-center gap-1.5 text-sm text-muted-foreground pb-0.5"
								>
									<span className="font-semibold text-foreground">
										Company Brain
									</span>
									<span className="inline-flex items-center gap-1 font-mono text-xs text-accent">
										<LoaderCircle
											className="size-3 animate-spin"
											aria-hidden="true"
										/>
										{currentToolStep
											? ASSISTANT_TOOL_STEP_LABELS[currentToolStep.step]
											: ASSISTANT_ACTIVITY_LABELS[
													custom.activity || "preparing"
												]}
									</span>
								</output>
								{custom.toolSteps && custom.toolSteps.length > 0 && (
									<AssistantToolProgress
										steps={custom.toolSteps}
										isRunning={isThreadRunning}
									/>
								)}
								<div className="py-1">
									<div
										aria-hidden="true"
										className="h-1 w-36 overflow-hidden rounded-full bg-accent/10"
									>
										<div className="h-full w-2/5 rounded-full bg-accent/60 animate-pulse" />
									</div>
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

						<div className="flex-1 min-w-0 space-y-1.5">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-1.5 flex-wrap">
									<span className="text-sm font-semibold text-foreground tracking-tight">
										Company Brain
									</span>
									{custom.latencyMs !== undefined && (
										<span className="text-xs font-mono text-muted-foreground bg-surface-alt px-1.5 py-0.2 rounded border border-border/50">
											⚡ {(custom.latencyMs / 1000).toFixed(1)}s
										</span>
									)}
								</div>

								<Button
									variant="ghost"
									size="icon-xs"
									className="size-6 text-muted-foreground hover:text-foreground"
									onClick={() => handleCopy(message.id, rawText)}
									title={
										copiedId === message.id
											? "Response copied"
											: "Copy response"
									}
									aria-label={
										copiedId === message.id
											? "Response copied"
											: "Copy response"
									}
								>
									{copiedId === message.id ? (
										<Check className="size-3 text-emerald-600" />
									) : (
										<Copy className="size-3" />
									)}
								</Button>
							</div>

							{custom.toolSteps && custom.toolSteps.length > 0 && (
								<AssistantToolProgress
									steps={custom.toolSteps}
									isRunning={isThreadRunning}
								/>
							)}

							{/* Failure State vs Normal Markdown Bubble */}
							{isFailure ? (
								<div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive space-y-1 shadow-xs">
									<div className="flex items-center gap-1.5 font-semibold">
										<AlertCircle className="size-3.5 shrink-0" />
										<span>Unable to complete response</span>
									</div>
									<p className="text-muted-foreground leading-relaxed pl-5">
										{rawText.replace(/^⚠️\s*/, "")}
									</p>
								</div>
							) : (
								<div className="pt-0.5 text-foreground">
									<div className="assistant-prose prose dark:prose-invert max-w-none">
										<MessagePrimitive.Parts
											components={assistantMessagePartComponents}
										/>
									</div>
								</div>
							)}
							{custom.questions?.map((questionSet) => (
								<AssistantQuestionCard
									key={questionSet.requestId}
									questionSet={questionSet}
									answered={threadMessages.some(
										(candidate) =>
											candidate.index > message.index &&
											candidate.role === "user",
									)}
									onSubmit={(answers) =>
										aui.thread.append({
											role: "user",
											content: [{ type: "text", text: answers }],
											startRun: true,
										})
									}
								/>
							))}
							{!isFailure && custom.charts && custom.charts.length > 0 && (
								<div className="space-y-2">
									{custom.charts.filter(isAssistantChartSpec).map((chart) => (
										<AssistantChartLoader
											key={`${message.id}-${chart.type}-${chart.title}-${chart.asOf}`}
											chart={chart}
										/>
									))}
								</div>
							)}

							{custom.pitches?.map((pitch) => (
								<PitchResponseAttachments
									key={`${pitch.draftId}-${pitch.revision}`}
									pitch={pitch}
								/>
							))}
							{/* Grounded Citation Chips */}
							{custom.citations && custom.citations.length > 0 && (
								<div className="pt-0.5">
									<CitationChips citations={citations} messageId={message.id} />
								</div>
							)}

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
	);
}
