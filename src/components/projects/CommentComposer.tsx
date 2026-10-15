"use client";

import { Send } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

interface CommentComposerProps {
	placeholder?: string;
	submitLabel?: string;
	parentId?: string | null;
	stageKey?: string | null;
	canRecordDecision?: boolean;
	onSubmit: (body: string, isDecision: boolean) => Promise<void>;
	onCancel?: () => void;
}

export function CommentComposer({
	placeholder = "Share an update, design note, or client feedback...",
	submitLabel = "Post Update",
	canRecordDecision = true,
	onSubmit,
	onCancel,
}: CommentComposerProps) {
	const [isPending, startTransition] = useTransition();
	const [body, setBody] = useState("");
	const [isDecision, setIsDecision] = useState(false);
	const decisionCheckboxId = useId();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!body.trim()) return;

		startTransition(async () => {
			await onSubmit(body.trim(), isDecision);
			setBody("");
			setIsDecision(false);
		});
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="border border-border bg-card p-3 space-y-3"
		>
			<Textarea
				value={body}
				onChange={(e) => setBody(e.target.value)}
				placeholder={placeholder}
				rows={3}
				required
				className="text-xs resize-y"
			/>

			<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
				{canRecordDecision ? (
					<label
						htmlFor={decisionCheckboxId}
						className="flex cursor-pointer items-center gap-2 select-none"
					>
						<Checkbox
							id={decisionCheckboxId}
							checked={isDecision}
							onCheckedChange={(checked) => setIsDecision(Boolean(checked))}
						/>
						<span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
							Record as official Project Decision
						</span>
					</label>
				) : (
					<div />
				)}

				<div className="flex items-center gap-2">
					{onCancel && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onCancel}
							disabled={isPending}
							className="text-xs h-7"
						>
							Cancel
						</Button>
					)}
					<Button
						type="submit"
						size="sm"
						disabled={isPending || !body.trim()}
						className="text-xs h-7 gap-1.5"
					>
						<Send className="size-3" />
						{isPending ? "Posting..." : submitLabel}
					</Button>
				</div>
			</div>
		</form>
	);
}
