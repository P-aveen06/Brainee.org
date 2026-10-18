import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createDb } from "@/db";
import { callBrowser } from "@/lib/ai/browser-client.server";
import { pitchPackageSchema } from "@/lib/ai/pitch-types";
import { visibleProjectIdsFor } from "@/lib/project-access";
import { authMiddleware } from "@/lib/server-fn";

export const exportPitchPdf = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z
			.object({
				pitch: pitchPackageSchema,
				mode: z.enum(["presentation", "document"]),
			})
			.strict()
			.parse(data),
	)
	.handler(async ({ data, context }) => {
		const visible = await visibleProjectIdsFor(createDb(), context.user);
		const projectIds = [
			...data.pitch.scopeProjectIds,
			...data.pitch.sources.flatMap((source) => source.projectIds),
		];
		if (visible !== "all" && projectIds.some((id) => !visible.includes(id)))
			throw new Error("A source project is no longer accessible.");
		const result = await callBrowser({ operation: "pdf", ...data });
		if (typeof result.base64 !== "string" || result.base64.length > 12_000_000)
			throw new Error("PDF generation failed.");
		return { base64: result.base64 };
	});
