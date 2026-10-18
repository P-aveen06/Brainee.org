export function adaptEstimate(input: {
	estimateHours: number | null;
	actualHours: number | null;
	factor: number;
	additionalHours: number;
	complete: boolean;
}) {
	if (
		!Number.isFinite(input.factor) ||
		input.factor < 0.25 ||
		input.factor > 4 ||
		!Number.isFinite(input.additionalHours) ||
		input.additionalHours < 0 ||
		input.additionalHours > 1000
	)
		throw new Error("Invalid estimate adjustment.");
	const baseline = input.actualHours ?? input.estimateHours;
	return {
		historicalEstimate: input.estimateHours,
		historicalActual: input.actualHours,
		baseline,
		baselineSource:
			input.actualHours !== null
				? "recorded_actual"
				: input.estimateHours !== null
					? "original_estimate"
					: "unknown",
		proposedHours:
			baseline === null
				? null
				: Math.round((baseline * input.factor + input.additionalHours) * 10) /
					10,
		factor: input.factor,
		additionalHours: input.additionalHours,
		confidence:
			baseline !== null && input.complete && input.actualHours !== null
				? "supported"
				: "limited",
		missingEvidence: [
			baseline === null
				? "No historical hours: the total remains unknown."
				: "",
			input.actualHours === null ? "No recorded actual effort." : "",
			!input.complete
				? "The source task family has incomplete effort records."
				: "",
		].filter(Boolean),
	};
}
