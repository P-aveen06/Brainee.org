import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadPitchExport } from "@/lib/ai/pitch-download";
import type { PitchPackage } from "@/lib/ai/pitch-types";

export function PitchExports({
	pitch,
	mode,
}: {
	pitch: PitchPackage;
	mode: "presentation" | "document";
}) {
	const [busy, setBusy] = useState(false);
	async function download(pdf: boolean) {
		setBusy(true);
		try {
			await downloadPitchExport(
				pitch,
				pdf ? `${mode}-pdf` : mode === "presentation" ? "pptx" : "docx",
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Export failed. Please retry.",
			);
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className="flex flex-wrap gap-2">
			<Button size="sm" disabled={busy} onClick={() => void download(false)}>
				{busy ? "Preparing…" : mode === "presentation" ? "PowerPoint" : "Word"}
			</Button>
			<Button
				size="sm"
				variant="outline"
				disabled={busy}
				onClick={() => void download(true)}
			>
				PDF copy
			</Button>
		</div>
	);
}
