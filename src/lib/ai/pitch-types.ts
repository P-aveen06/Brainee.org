import { z } from "zod";

const text = z.string().trim().min(1);
export const pitchSectionSchema = z
	.object({
		id: text.max(80),
		title: text.max(120),
		kind: z.enum(["overview", "capability", "case_study", "next_steps"]),
		slide: text.max(650),
		document: text.max(4000),
		sourceIds: z.array(text.max(2200)).max(12),
		gaps: z.array(text.max(300)).max(8),
	})
	.strict();

export const pitchInputSchema = z
	.object({
		draftId: text
			.max(100)
			.optional()
			.describe(
				"Only supply draftId when revising an existing saved pitch package returned earlier in this conversation. Omit draftId when creating a new pitch package; the system assigns the draftId automatically.",
			),
		title: text.max(160),
		audience: text.max(200),
		objective: text.max(500),
		sections: z.array(pitchSectionSchema).min(1).max(20),
	})
	.strict();

export const pitchSourceSchema = z
	.object({
		id: text.max(2200),
		label: text.max(500),
		kind: z.enum(["workspace", "public"]),
		excerpt: z.string().max(2000),
		url: z.string().url().optional(),
		projectIds: z.array(text).max(200),
	})
	.strict();

export const pitchPackageSchema = pitchInputSchema
	.extend({
		draftId: text.max(100),
		revision: z.number().int().min(1),
		createdAt: z.string().datetime(),
		sources: z.array(pitchSourceSchema).max(100),
		scopeProjectIds: z.array(text).max(200),
		status: z.literal("draft"),
	})
	.strict();

export type PitchInput = z.infer<typeof pitchInputSchema>;
export type PitchSource = z.infer<typeof pitchSourceSchema>;
export type PitchPackage = z.infer<typeof pitchPackageSchema>;

export interface PitchTurnState {
	evidence: Map<string, PitchSource>;
	drafts: PitchPackage[];
}

export function parsePitch(value: unknown): PitchPackage | undefined {
	const result = pitchPackageSchema.safeParse(value);
	if (!result.success) return undefined;
	const pitch = result.data;
	const sourceIds = new Set(pitch.sources.map((source) => source.id));
	if (
		pitch.sections.some((section) =>
			section.sourceIds.some((id) => !sourceIds.has(id)),
		)
	)
		return undefined;
	return pitch;
}

export function createPitch(
	input: unknown,
	state: PitchTurnState,
): PitchPackage {
	const parsed = pitchInputSchema.parse(input);
	const previous = parsed.draftId
		? state.drafts.filter((draft) => draft.draftId === parsed.draftId).at(-1)
		: undefined;
	if (parsed.draftId && !previous) {
		throw new Error(
			`Draft "${parsed.draftId}" was not found in this conversation. Reopen the conversation where this draft was saved to revise it, or omit draftId to create a new pitch package.`,
		);
	}
	if (
		new Set(parsed.sections.map((section) => section.id)).size !==
		parsed.sections.length
	)
		throw new Error("Each pitch section needs a unique ID.");
	const sourceIds = [
		...new Set(parsed.sections.flatMap((section) => section.sourceIds)),
	];
	const sources = sourceIds.map((id) => {
		const source = state.evidence.get(id);
		if (!source)
			throw new Error(`Retrieve supporting evidence before citing ${id}.`);
		return source;
	});
	for (const section of parsed.sections) {
		if (section.kind === "capability" || section.kind === "case_study") {
			if (
				!section.sourceIds.some(
					(id) => state.evidence.get(id)?.kind === "workspace",
				)
			)
				throw new Error(
					"Capabilities and case studies require workspace evidence; public research cannot prove company delivery.",
				);
		}
	}
	return pitchPackageSchema.parse({
		...parsed,
		draftId: previous?.draftId ?? `pitch-${crypto.randomUUID()}`,
		revision: (previous?.revision ?? 0) + 1,
		createdAt: new Date().toISOString(),
		sources,
		scopeProjectIds: [
			...new Set(sources.flatMap((source) => source.projectIds)),
		],
		status: "draft",
	});
}
