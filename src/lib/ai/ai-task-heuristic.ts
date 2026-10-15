export interface ExtractionPayload {
	title: string;
	status: "todo" | "in_progress" | "done" | "blocked";
	description?: string;
}

/**
 * Splits text into distinct task phrases for heuristic fallback.
 */
export function splitSummaryIntoTaskPhrases(summary: string): string[] {
	const clean = summary.trim();

	// Check bullet lines or newlines
	const lines = clean
		.split(/\r?\n/)
		.map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
		.filter((l) => l.length > 2);
	if (lines.length > 1) {
		return lines;
	}

	// Check semicolons
	if (clean.includes(";")) {
		const parts = clean
			.split(";")
			.map((p) => p.trim())
			.filter((p) => p.length > 2);
		if (parts.length > 1) return parts;
	}

	// Check comma/conjunction separated clauses
	const clauseSplit = clean
		.split(
			/,\s*(?:and\s+)?|\s+and\s+(?=(?:worked|work|working|fixed|fix|fixing|tested|test|testing|built|build|building|created|create|updated|update|added|add|resolved|refactored|reviewed|review|implemented|implement|debugged|debug|deployed|deploy|designed|design|configured|configure|verified|verify|wrote|write|completed)\b)/i,
		)
		.map((s) => s.trim().replace(/\.+$/, ""))
		.filter((s) => s.length > 2);

	if (clauseSplit.length > 1) {
		return clauseSplit;
	}

	return [clean];
}

/**
 * Heuristic fallback when LLM is offline or no API key is set.
 */
export function heuristicExtract(
	summary: string,
	blockers?: string | null,
): ExtractionPayload[] {
	const phrases = splitSummaryIntoTaskPhrases(summary);
	const lower = summary.toLowerCase();
	const hasBlockers = Boolean(blockers && blockers.trim().length > 0);

	return phrases.map((phrase) => {
		const clean = phrase.trim().replace(/^[-*•\s]+/, "");
		const title = clean.length > 75 ? `${clean.slice(0, 72)}...` : clean;

		let status: "todo" | "in_progress" | "done" | "blocked" = "done";
		const pLower = phrase.toLowerCase();

		if (hasBlockers) {
			status = "blocked";
		} else if (
			pLower.includes("working on") ||
			pLower.includes("in progress") ||
			pLower.includes("investigating") ||
			pLower.includes("debugging") ||
			pLower.includes("continuing") ||
			pLower.includes("started") ||
			lower.includes("in progress")
		) {
			status = "in_progress";
		}

		return {
			title: title.charAt(0).toUpperCase() + title.slice(1),
			status,
			description: phrase,
		};
	});
}
