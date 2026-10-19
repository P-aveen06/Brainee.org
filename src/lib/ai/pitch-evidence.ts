import type { GroundedLabel } from "./citations";
import {
	type PitchSource,
	type PitchTurnState,
	parsePitch,
} from "./pitch-types";

const deliveryTools = new Set([
	"list_projects",
	"get_project",
	"get_project_tasks",
	"get_project_risks",
	"get_project_checklist",
	"get_portfolio_evidence",
	"get_project_discussions",
	"get_project_documents",
	"get_project_timeline",
	"search_delivery_knowledge",
	"get_implementation_context",
	"read_document_passages",
]);

export function collectPitchEvidence(
	state: PitchTurnState,
	name: string,
	data: unknown,
	labels: GroundedLabel[],
	scopeProjectIds: string[] = [],
) {
	if (!deliveryTools.has(name)) return;
	const byId = new Map<string, Record<string, unknown>>();
	function visit(value: unknown, depth = 0) {
		if (depth > 8 || !value || typeof value !== "object") return;
		if (Array.isArray(value)) {
			for (const item of value) visit(item, depth + 1);
			return;
		}
		const row = value as Record<string, unknown>;
		if (typeof row.id === "string" && !byId.has(row.id)) byId.set(row.id, row);
		for (const child of Object.values(row)) visit(child, depth + 1);
	}
	visit(data);
	for (const label of labels) {
		const row = byId.get(label.id);
		const projectIds = label.projectId
			? [label.projectId]
			: typeof row?.projectId === "string"
				? [row.projectId]
				: name === "list_projects" || name === "get_project"
					? [label.id]
					: scopeProjectIds;
		// Do not persist evidence whose permission scope cannot be checked on reload.
		if (!projectIds.length) continue;
		const excerpt =
			[
				label.description,
				row?.excerpt,
				row?.text,
				row?.body,
				row?.description,
				row?.title,
			].find(
				(value): value is string => typeof value === "string" && !!value.trim(),
			) ?? label.label;
		state.evidence.set(label.id, {
			id: label.id,
			label: label.label.slice(0, 500),
			kind: "workspace",
			excerpt: excerpt.slice(0, 2000),
			projectIds,
		});
	}
}

export function restorePitchState(
	rows: Array<{ role: string; content: string | null }>,
	canSee: (projectId: string) => boolean,
): PitchTurnState {
	const state: PitchTurnState = { evidence: new Map(), drafts: [] };
	for (const row of rows) {
		if (row.role !== "tool" || !row.content) continue;
		try {
			const payload = JSON.parse(row.content);
			const pitch = parsePitch(payload.result?.pitch);
			if (
				!pitch ||
				!pitch.scopeProjectIds.every(canSee) ||
				!pitch.sources.every((source) => source.projectIds.every(canSee))
			)
				continue;
			state.drafts.push(pitch);
			for (const source of pitch.sources) {
				if (source.projectIds.every(canSee))
					state.evidence.set(source.id, source);
			}
		} catch {
			/* Ignore legacy and malformed tool rows. */
		}
	}
	return state;
}

export function publicPitchSource(
	url: string,
	title: string,
	text: string,
): PitchSource {
	return {
		id: `web:${url}`,
		label: title.slice(0, 500) || url,
		kind: "public",
		url,
		excerpt: text.slice(0, 2000),
		projectIds: [],
	};
}
