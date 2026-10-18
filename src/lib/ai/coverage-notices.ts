/** Deterministic coverage text survives model omissions and is saved with the answer. */
export function coverageNotices(value: unknown): string[] {
	if (!value || typeof value !== "object") return [];
	const data = value as Record<string, unknown>;
	const messages: string[] = [];
	const coverage = data.documentCoverage as Record<string, unknown> | undefined;
	if (coverage && typeof coverage.currentDocuments === "number") {
		const total = coverage.currentDocuments;
		const indexed = Number(coverage.indexedDocuments ?? 0);
		if (total === 0)
			messages.push(
				"Knowledge coverage: no project documents are loaded in this workspace.",
			);
		else if (indexed < total)
			messages.push(
				`Knowledge coverage: ${indexed} of ${total} current documents are fully indexed. Unindexed, unsupported, failed, empty or truncated files may contain additional evidence.`,
			);
	}
	const retrieval = data.retrievalCoverage as
		| { semantic?: { state?: string } }
		| undefined;
	if (retrieval?.semantic?.state && retrieval.semantic.state !== "ready")
		messages.push(
			"Search coverage: semantic indexing is incomplete or unavailable; relevant matches may be missing.",
		);
	if (data.complete === false && data.scope === "permitted_projects")
		messages.push(
			"Evidence coverage: this is a partial page of the permitted portfolio. Additional records remain.",
		);
	return messages;
}
