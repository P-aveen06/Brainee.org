"use client";

import {
	CheckCircle2,
	FileText,
	FolderKanban,
	Laptop,
	ListChecks,
} from "lucide-react";
import { useState } from "react";
import type { CitationRef } from "@/lib/ai/citations";

interface CitationChipsProps {
	citations: CitationRef[];
}

export function CitationChips({ citations }: CitationChipsProps) {
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
			<span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
				<CheckCircle2 className="size-3 text-emerald-500/80" />
				<span>Sources</span>
			</span>
			{displayCitations.map((c) => (
				<span
					key={`${c.id}-${c.label}`}
					className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface-alt px-2 py-0.5 text-[10px] font-mono text-muted-foreground shadow-2xs hover:border-accent/40 hover:text-foreground transition-all"
				>
					{getIcon(c.type)}
					<span>{c.label}</span>
				</span>
			))}
			{!expanded && remainingCount > 0 && (
				<button
					type="button"
					onClick={() => setExpanded(true)}
					className="inline-flex items-center rounded-full border border-border/70 bg-surface-alt px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:border-accent/40 hover:text-foreground transition-all cursor-pointer"
				>
					+{remainingCount} more
				</button>
			)}
		</div>
	);
}
