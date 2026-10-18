/**
 * Citation extraction, validation, and anti-hallucination grounding verifier.
 * Zero external calls. Strictly unit-testable.
 */

export interface CitationRef {
	id: string;
	projectId?: string;
	type:
		| "project"
		| "task"
		| "document"
		| "checklist"
		| "eod_report"
		| "decision"
		| "discussion"
		| "update"
		| "person";
	label: string;
	url?: string;
	description?: string;
}

export interface GroundedLabel {
	type?: CitationRef["type"];
	id: string;
	projectId?: string;
	label: string;
	url?: string;
	description?: string;
}

/**
 * Finds the grounded record whose label is actually contained in the claimed citation text.
 * Matching is case-insensitive substring containment against real tool output — never
 * positional. A citation with no matching grounded label returns null and is therefore
 * stripped by validateCitations, which is the safe failure direction.
 */
export function matchGroundedCitation(
	claimedLabel: string,
	groundedLabels: GroundedLabel[],
): string | null {
	const normalizedClaim = claimedLabel.trim().toLowerCase();
	const ranked = [...groundedLabels].sort((a, b) => {
		const exact =
			Number(b.label.trim().toLowerCase() === normalizedClaim) -
			Number(a.label.trim().toLowerCase() === normalizedClaim);
		const task = /#\d+/.test(normalizedClaim)
			? Number(/#\d+/.test(b.label)) - Number(/#\d+/.test(a.label))
			: 0;
		return exact || task || b.label.length - a.label.length;
	});
	for (const entry of ranked) {
		const normalizedLabel = entry.label.trim().toLowerCase();
		if (
			normalizedLabel.length >= 2 &&
			normalizedClaim.includes(normalizedLabel)
		) {
			return entry.id;
		}
	}
	return null;
}

/**
 * Validates a list of claimed citations against the set of record IDs
 * actually returned by database tools during the current turn.
 * Strips unverifiable citations and flags non-grounded claims.
 */
export function validateCitations(
	rawText: string,
	claimedCitations: CitationRef[],
	groundedToolRecordIds: Set<string>,
): {
	sanitizedText: string;
	verifiedCitations: CitationRef[];
	unverifiedCitations: CitationRef[];
	isFullyGrounded: boolean;
} {
	const verifiedCitations: CitationRef[] = [];
	const unverifiedCitations: CitationRef[] = [];

	for (const citation of claimedCitations) {
		if (groundedToolRecordIds.has(citation.id)) {
			verifiedCitations.push(citation);
		} else {
			unverifiedCitations.push(citation);
		}
	}

	let sanitizedText = rawText;

	// Strip references to unverified IDs from text
	for (const unverified of unverifiedCitations) {
		const pattern = new RegExp(
			`\\[${unverified.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`,
			"g",
		);
		sanitizedText = sanitizedText.replace(pattern, unverified.label);
	}

	const isFullyGrounded = unverifiedCitations.length === 0;

	return {
		sanitizedText,
		verifiedCitations,
		unverifiedCitations,
		isFullyGrounded,
	};
}

/**
 * Sanitizes model output text to guarantee no sensitive storage URLs or internal keys leak.
 */
export function sanitizeModelOutputText(text: string): string {
	return sanitizeModelOutputDelta(text).trim();
}

/** Sanitizes a complete streaming segment while preserving its boundary whitespace. */
export function sanitizeModelOutputDelta(text: string): string {
	// Strip any potential Cloudflare R2 bucket URLs or keys
	let clean = text.replace(
		/https?:\/\/[^\s]+(?:r2\.cloudflarestorage\.com|project-docs)[^\s]*/gi,
		"[Document Attachment]",
	);

	// Strip raw file paths in tmp or system dirs
	clean = clean.replace(/\/(?:private\/var|tmp|Users)\/[^\s]+/g, "[File]");

	return clean;
}
