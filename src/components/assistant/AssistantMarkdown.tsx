"use client";

import { useAuiState } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import remarkGfm from "remark-gfm";
import { getTaskCitationDetails } from "@/api/ai-assistant-citations";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CitationRef } from "@/lib/ai/citations";
import { AssistantMarkdownTable } from "./AssistantDataTable";
import type { MessageCustomData } from "./AssistantRuntimeAdapter";
import {
	citationAnchorId,
	formatCitationMarkers,
	uniqueCitations,
} from "./citation-markers";

const remarkPlugins = [remarkGfm];

function AssistantMessagePart() {
	const message = useAuiState((state) => state.message);
	const custom = message.metadata.custom as
		| Partial<MessageCustomData>
		| undefined;
	const citations = useMemo(
		() => uniqueCitations(custom?.citations ?? []),
		[custom?.citations],
	);
	return <AssistantMessageText citations={citations} messageId={message.id} />;
}

export const assistantMessagePartComponents = { Text: AssistantMessagePart };

interface RelatedTask {
	id: string;
	projectId?: string;
	relation: string;
	label: string;
}

function CitationMarkerLink({
	citation,
	link,
}: {
	citation: CitationRef;
	link: React.ReactElement;
}) {
	const navigate = useNavigate();
	const [description, setDescription] = useState(citation.description);
	const [relatedTasks, setRelatedTasks] = useState<RelatedTask[]>([]);
	const [relatedTasksRemaining, setRelatedTasksRemaining] = useState(0);
	const [loading, setLoading] = useState(false);
	const [requested, setRequested] = useState(false);
	const projectCode =
		citation.projectId ||
		citation.label.match(/^([A-Za-z0-9][A-Za-z0-9_-]*)\s+#\d+\b/)?.[1];

	const loadTaskDetails = () => {
		if (citation.type !== "task" || requested || !projectCode) return;
		setRequested(true);
		setLoading(true);
		void getTaskCitationDetails({
			data: { projectCode, taskId: citation.id },
		})
			.then((result) => {
				if (result.description) setDescription(result.description);
				setRelatedTasks(result.relatedTasks);
				setRelatedTasksRemaining(result.relatedTasksRemaining);
			})
			.catch(() => setRequested(false))
			.finally(() => setLoading(false));
	};

	return (
		<Tooltip
			disableHoverablePopup={false}
			onOpenChange={(open) => open && loadTaskDetails()}
		>
			<TooltipTrigger render={link} delay={200} closeDelay={350} />
			<TooltipContent className="w-72 max-w-[min(24rem,calc(100vw-2rem))] flex-col items-start gap-2 rounded-xl border border-border bg-popover p-3 text-left text-popover-foreground shadow-lg">
				<div className="flex w-full min-w-0 items-center gap-2 text-xs text-muted-foreground">
					<span className="shrink-0 rounded-sm bg-accent/10 px-1.5 py-0.5 font-medium capitalize text-accent">
						{citation.type.replaceAll("_", " ")}
					</span>
					<span className="truncate font-mono">{citation.label}</span>
				</div>
				<p className="w-full whitespace-pre-line text-sm leading-relaxed text-foreground">
					{description ||
						(loading
							? "Loading task details…"
							: citation.type === "task"
								? "Task details are unavailable right now."
								: `This ${citation.type.replaceAll("_", " ")} record is cited as evidence for the answer.`)}
				</p>
				{relatedTasks.length > 0 && (
					<div className="w-full space-y-1 border-t border-border pt-2">
						<p className="text-xs font-medium text-muted-foreground">
							Related tasks
						</p>
						<div className="max-h-40 space-y-1 overflow-y-auto">
							{relatedTasks.map((task) => (
								<button
									key={`${task.relation}:${task.id}`}
									type="button"
									disabled={!task.projectId}
									onClick={() => {
										if (!task.projectId) return;
										void navigate({
											to: "/projects/$id",
											params: { id: task.projectId },
											search: { tab: "tasks", focusTask: task.id },
										});
									}}
									className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/10 disabled:cursor-default"
								>
									<span className="shrink-0 rounded-sm bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
										{task.relation}
									</span>
									<span className="min-w-0 break-words text-foreground">
										{task.label}
									</span>
								</button>
							))}
							{relatedTasksRemaining > 0 && (
								<p className="px-2 py-1 text-xs text-muted-foreground">
									+{relatedTasksRemaining} more subtasks
								</p>
							)}
						</div>
					</div>
				)}
			</TooltipContent>
		</Tooltip>
	);
}

function markdownComponents(citations: CitationRef[], messageId: string) {
	return {
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
		a: ({
			node: _node,
			...props
		}: React.ComponentProps<"a"> & { node?: unknown }) => {
			const citationIndex = citations.findIndex(
				(_, index) => props.href === `#${citationAnchorId(messageId, index)}`,
			);
			const citation =
				citationIndex >= 0 ? citations[citationIndex] : undefined;
			const link = (
				<a
					href={props.href}
					{...props}
					aria-label={
						citation ? `View source details: ${citation.label}` : undefined
					}
					className={
						citation
							? "mx-0.5 inline-flex min-w-4 items-center justify-center rounded-sm bg-muted/60 px-1 py-0.5 align-super text-[10px] leading-none font-medium text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
							: "text-accent underline underline-offset-2 hover:text-accent/80"
					}
				/>
			);
			if (!citation) return link;
			return <CitationMarkerLink citation={citation} link={link} />;
		},
	};
}

export function AssistantMessageText({
	citations,
	messageId,
}: {
	citations: CitationRef[];
	messageId: string;
}) {
	const components = useMemo(
		() => markdownComponents(citations, messageId),
		[citations, messageId],
	);
	return (
		<MarkdownTextPrimitive
			preprocess={(text) =>
				preprocessMarkdown(formatCitationMarkers(text, citations, messageId))
			}
			remarkPlugins={remarkPlugins}
			components={components}
			smooth={false}
			defer
		/>
	);
}

function preprocessMarkdown(text: string): string {
	let t = text.trim();
	// If a table separator row was joined with the header row on a single line (| col | |---|)
	t = t.replace(/\|\s*\|\s*([-:]{2,})/g, "|\n| $1");
	return t;
}
