import { createClientOnlyFn } from "@tanstack/react-start";
import type { PitchPackage } from "./pitch-types";
import type { PitchExportFormat } from "./pitch-download.client";

export const downloadPitchExport = createClientOnlyFn(
	async (pitch: PitchPackage, format: PitchExportFormat) => {
		const client = await import("./pitch-download.client");
		return client.downloadPitchExport(pitch, format);
	},
);
