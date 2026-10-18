import { ArrowUpRight, FileDown, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	downloadPitchExport,
	type PitchExportFormat,
} from "@/lib/ai/pitch-download.client";
import type { PitchPackage } from "@/lib/ai/pitch-types";
import { useOpenPitch } from "./PitchWorkspace";

const exports: Array<{
	format: PitchExportFormat;
	label: string;
	mode: "presentation" | "document";
	extension: "pptx" | "docx" | "pdf";
}> = [
	{
		format: "pptx",
		label: "Presentation · PPTX",
		mode: "presentation",
		extension: "pptx",
	},
	{
		format: "docx",
		label: "Document · DOCX",
		mode: "document",
		extension: "docx",
	},
	{
		format: "presentation-pdf",
		label: "Slides · PDF",
		mode: "presentation",
		extension: "pdf",
	},
	{
		format: "document-pdf",
		label: "Written · PDF",
		mode: "document",
		extension: "pdf",
	},
];

export function PitchResponseAttachments({ pitch }: { pitch: PitchPackage }) {
	const [downloading, setDownloading] = useState<PitchExportFormat | null>(
		null,
	);
	const openPitch = useOpenPitch();
	const fileTitle =
		pitch.title
			.replace(/[^a-z0-9]+/gi, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 80) || "pitch";

	async function download(format: PitchExportFormat) {
		setDownloading(format);
		try {
			await downloadPitchExport(pitch, format);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Export failed. Please retry.",
			);
		} finally {
			setDownloading(null);
		}
	}

	return (
		<div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
			<span className="mr-0.5 text-[11px] font-medium text-muted-foreground">
				Files
			</span>
			{exports.map((item) => (
				<Button
					key={item.format}
					variant="ghost"
					size="xs"
					className="h-6 border border-border/50 bg-transparent text-[11px] font-normal text-muted-foreground hover:border-border hover:bg-surface-alt hover:text-foreground"
					disabled={downloading !== null}
					title={`${fileTitle}-v${pitch.revision}-${item.mode}.${item.extension}`}
					aria-label={`Download ${item.label}`}
					onClick={() => void download(item.format)}
				>
					{downloading === item.format ? (
						<LoaderCircle className="animate-spin" />
					) : (
						<FileDown />
					)}
					{item.label}
				</Button>
			))}
			<Button
				variant="link"
				size="xs"
				className="h-7 px-1.5 text-[11px] text-muted-foreground"
				onClick={() => openPitch(pitch)}
			>
				Preview <ArrowUpRight />
			</Button>
		</div>
	);
}
