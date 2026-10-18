"use client";

import {
	CheckCircle2,
	FileText,
	FolderKanban,
	Laptop,
	ListChecks,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CitationRef } from "@/lib/ai/citations";
import { citationAnchorId } from "./citation-markers";

interface CitationChipsProps {
	citations: CitationRef[];
	messageId?: string;
}

export function CitationChips({ citations, messageId }: CitationChipsProps) {
	const [expanded, setExpanded] = useState(false);
	if (!citations || citations.length === 0) return null;

	const getIcon = (type: string) => {
		switch (type) {
			case "task":
				return <ListChecks className="size-2.5 text-accent shrink-0" />;
			case "document":
				return <FileText className="size-2.5 text-blue-500 shrink-0" />;
			case "asset":
				return <Laptop className="size-2.5 text-emerald-500 shrink-0" />;
			default:
				return <FolderKanban className="size-2.5 text-accent shrink-0" />;
		}
	};

	const displayCitations = expanded ? citations : citations.slice(0, 4);
	const remainingCount = citations.length - 4;

	return (
		<div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-xs">
			<span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
				<CheckCircle2 className="size-3 text-emerald-500/80" />
				<span>Sources</span>
			</span>
			{displayCitations.map((c, index) => (
				<Badge
					key={`${c.id}-${c.label}`}
					id={messageId ? citationAnchorId(messageId, index) : undefined}
					variant="chip"
					render={
						c.url?.startsWith("/api/delivery/documents/")
							? (props) => (
									<a
										{...props}
										href={c.url}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={`Open source: ${c.label}`}
									>
										{props.children}
									</a>
								)
							: undefined
					}
					className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface-alt px-2 py-0.5 text-xs font-mono text-muted-foreground shadow-2xs hover:border-accent/40 hover:text-foreground transition-all"
				>
					{messageId && (
						<span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-accent/10 font-sans text-[10px] leading-none font-semibold text-accent">
							{index + 1}
						</span>
					)}
					{getIcon(c.type)}
					<span>{c.label}</span>
				</Badge>
			))}
			{!expanded && remainingCount > 0 && (
				<Button
					variant="ghost"
					size="sm"
					type="button"
					onClick={() => setExpanded(true)}
					className="inline-flex items-center rounded-full border border-border/70 bg-surface-alt px-1.5 py-0.5 text-xs font-mono text-muted-foreground hover:border-accent/40 hover:text-foreground transition-all cursor-pointer"
				>
					+{remainingCount} more
				</Button>
			)}
		</div>
	);
}
