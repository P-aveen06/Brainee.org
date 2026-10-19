import { useAui, useAuiState } from "@assistant-ui/react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { PillToggle } from "@/components/ui/pill-toggle";
import { Textarea } from "@/components/ui/textarea";
import { pitchHtml } from "@/lib/ai/pitch-html";
import type { PitchPackage } from "@/lib/ai/pitch-types";
import { PitchExports } from "./PitchExports";

export function PitchCanvas({
	pitch,
	onClose,
}: {
	pitch: PitchPackage;
	onClose: () => void;
}) {
	const [mode, setMode] = useState<"presentation" | "document">("presentation");
	const [page, setPage] = useState(0);
	const [changeRequest, setChangeRequest] = useState("");
	const aui = useAui();
	const isRunning = useAuiState((state) => state.thread.isRunning);
	const currentPage = Math.min(page, pitch.sections.length - 1);
	const sections =
		mode === "presentation" ? [pitch.sections[currentPage]] : pitch.sections;
	const refine = (request: string) => {
		aui.thread.append({
			role: "user",
			content: [
				{
					type: "text",
					text: `${request} for pitch draft ${pitch.draftId} (revision ${pitch.revision}). Preserve source-backed facts and update both formats.`,
				},
			],
			startRun: true,
		});
	};
	const submitChange = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const request = changeRequest.trim();
		if (!request || isRunning) return;
		refine(request);
		setChangeRequest("");
	};
	return (
		<aside
			className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-surface-alt"
			aria-label="Pitch canvas"
		>
			<header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background p-4">
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-sm font-bold">{pitch.title}</h2>
					<p className="text-xs text-muted-foreground">
						Internal draft · Revision {pitch.revision} · {pitch.audience}
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					aria-label="Close pitch canvas"
				>
					<X />
				</Button>
				<div className="flex w-full flex-wrap items-center justify-between gap-3">
					<PillToggle
						ariaLabel="Pitch format"
						value={mode}
						onChange={(value) => setMode(value as typeof mode)}
						items={[
							{ value: "presentation", label: "Presentation" },
							{ value: "document", label: "Document" },
						]}
					/>
					<PitchExports pitch={pitch} mode={mode} />
				</div>
			</header>
			<iframe
				className="min-h-0 w-full flex-1 border-0 bg-white"
				sandbox=""
				title={`${pitch.title} ${mode} preview`}
				srcDoc={pitchHtml({ ...pitch, sections }, mode)}
			/>
			{mode === "presentation" && (
				<div className="flex items-center justify-center gap-4 border-t border-border py-2">
					<Button
						variant="outline"
						size="icon-sm"
						disabled={currentPage === 0}
						onClick={() => setPage(currentPage - 1)}
						aria-label="Previous slide"
					>
						<ArrowLeft />
					</Button>
					<span className="text-xs text-muted-foreground">
						{currentPage + 1} / {pitch.sections.length}
					</span>
					<Button
						variant="outline"
						size="icon-sm"
						disabled={currentPage === pitch.sections.length - 1}
						onClick={() => setPage(currentPage + 1)}
						aria-label="Next slide"
					>
						<ArrowRight />
					</Button>
				</div>
			)}
			<footer className="space-y-3 border-t border-border bg-background p-3">
				<div className="flex flex-wrap gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => refine("Shorten the presentation")}
					>
						Shorten slides
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refine("Expand the supporting case studies")}
					>
						Expand case studies
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							refine(
								"Use inspect_pitch_layout to check the layout and report issues",
							)
						}
					>
						Check layout
					</Button>
				</div>
				<form onSubmit={submitChange} className="space-y-2">
					<label
						htmlFor="pitch-change-request"
						className="text-xs font-medium text-foreground"
					>
						Make it yours
					</label>
					<div className="flex items-end gap-2">
						<Textarea
							id="pitch-change-request"
							rows={2}
							value={changeRequest}
							onChange={(event) => setChangeRequest(event.target.value)}
							placeholder="Describe a change to this deck…"
							className="min-h-16 flex-1 resize-y"
						/>
						<Button
							type="submit"
							size="sm"
							disabled={!changeRequest.trim() || isRunning}
						>
							Update draft
						</Button>
					</div>
				</form>
			</footer>
		</aside>
	);
}
