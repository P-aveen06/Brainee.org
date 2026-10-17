"use client";
import { MessagePrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { AlertCircle, Check, Copy } from "lucide-react";
import { useState } from "react";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isAssistantChartSpec } from "@/lib/ai/chart-types";
import { AssistantChartLoader } from "./AssistantChartLoader";
import { AssistantMarkdownTable } from "./AssistantDataTable";
import type { MessageCustomData } from "./AssistantRuntimeAdapter";
import { CitationChips } from "./CitationChips";
import { ProposedActionCard } from "./ProposedActionCard";

const markdownComponents = {
	table: AssistantMarkdownTable,
	thead: ({
		node: _node,
		...props
	}: React.ComponentProps<"thead"> & { node?: unknown }) => (
		<thead className="border-b border-border bg-surface-alt/80" {...props} />
	),
	tbody: ({
		node: _node,
		...props
	}: React.ComponentProps<"tbody"> & { node?: unknown }) => (
		<tbody className="divide-y divide-border/50" {...props} />
	),
	th: ({
		node: _node,
		...props
	}: React.ComponentProps<"th"> & { node?: unknown }) => (
		<th
			className="px-3 py-2 font-semibold text-foreground tracking-tight whitespace-nowrap"
			{...props}
		/>
	),
	td: ({
		node: _node,
		...props
	}: React.ComponentProps<"td"> & { node?: unknown }) => (
		<td className="px-3 py-2 text-foreground align-top" {...props} />
	),
};

const remarkPlugins = [remarkGfm];

function AssistantMessageText() {
	return (
		<MarkdownTextPrimitive
			preprocess={preprocessMarkdown}
			remarkPlugins={remarkPlugins}
			components={markdownComponents}
			smooth={false}
			defer
		/>
	);
}

const messagePartComponents = { Text: AssistantMessageText };

function preprocessMarkdown(text: string): string {
	let t = text.trim();
	// If a table separator row was joined with the header row on a single line (| col | |---|)
	t = t.replace(/\|\s*\|\s*([-:]{2,})/g, "|\n| $1");
	return t;
}

export function AssistantMessages({
	onProposalResolved,
}: {
	onProposalResolved?: () => void;
}) {
	const [copiedId, setCopiedId] = useState<string | null>(null);
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
								<div className="rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 px-4 py-2.5 shadow-xs text-sm leading-relaxed font-sans select-text">
									<MessagePrimitive.Parts components={messagePartComponents} />
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
										Company Brain
									</span>
									<span className="font-mono text-[10px] text-accent animate-pulse">
										Thinking…
									</span>
								</div>
								<div className="py-1 space-y-2 max-w-sm">
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
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-1.5 flex-wrap">
									<span className="text-xs font-semibold text-foreground tracking-tight">
										Company Brain
									</span>
									{custom.latencyMs !== undefined && (
										<span className="text-[10px] font-mono text-muted-foreground bg-surface-alt px-1.5 py-0.2 rounded border border-border/50">
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
								<div className="pt-0.5 text-sm leading-relaxed text-foreground">
									<div className="assistant-prose prose prose-sm dark:prose-invert max-w-none">
										<MessagePrimitive.Parts
											components={messagePartComponents}
										/>
									</div>
								</div>
							)}
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
	);
}
