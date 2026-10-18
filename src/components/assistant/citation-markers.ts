import type { CitationRef } from "@/lib/ai/citations";

export function uniqueCitations(citations: CitationRef[]): CitationRef[] {
	const seen = new Set<string>();
	return citations.filter((citation) => {
		const key = `${citation.id}\u0000${citation.label}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function citationMarker(index: number): string {
	return String(index + 1);
}

export function citationAnchorId(messageId: string, index: number): string {
	const safeMessageId = messageId.replace(/[^A-Za-z0-9_-]/g, "") || "message";
	return `assistant-source-${safeMessageId}-${index + 1}`;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceCitationMarkers(
	segment: string,
	citations: CitationRef[],
	messageId: string,
): string {
	return citations.reduce((text, citation, index) => {
		const pattern = new RegExp(
			`(?<!!)\\[${escapeRegExp(citation.label)}\\](?!\\s*\\()`,
			"gi",
		);
		return text.replace(
			pattern,
			`[${citationMarker(index)}](#${citationAnchorId(messageId, index)})`,
		);
	}, segment);
}

/** Replace visible source labels while preserving inline and fenced code verbatim. */
export function formatCitationMarkers(
	text: string,
	citations: CitationRef[],
	messageId: string,
): string {
	return text
		.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g)
		.map((segment, index) =>
			index % 2 === 1
				? segment
				: replaceCitationMarkers(segment, citations, messageId),
		)
		.join("");
}
