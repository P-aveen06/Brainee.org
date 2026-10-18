import { exportPitchPdf } from "@/api/ai-pitch-export";
import type { PitchPackage } from "./pitch-types";

export type PitchExportFormat =
	| "pptx"
	| "docx"
	| "presentation-pdf"
	| "document-pdf";

export async function downloadPitchExport(
	pitch: PitchPackage,
	format: PitchExportFormat,
) {
	const mode =
		format === "pptx" || format === "presentation-pdf"
			? "presentation"
			: "document";
	const extension =
		format === "pptx" ? "pptx" : format === "docx" ? "docx" : "pdf";
	let file: Blob;

	const { powerpointBlob, wordBlob, downloadPitchFile, pitchFileName } =
		await import("./pitch-office-exports");
	if (format === "pptx") {
		file = await powerpointBlob(pitch);
	} else if (format === "docx") {
		file = await wordBlob(pitch);
	} else {
		const result = await exportPitchPdf({ data: { pitch, mode } });
		const bytes = Uint8Array.from(atob(result.base64), (char) =>
			char.charCodeAt(0),
		);
		file = new Blob([bytes], { type: "application/pdf" });
	}
	downloadPitchFile(file, `${pitchFileName(pitch)}-${mode}.${extension}`);
}
