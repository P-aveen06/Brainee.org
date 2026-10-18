/** Providers sometimes materialize absent optional strings as "". Preserve required
 * inputs for validation, and preserve meaningful zero/false values. */
export function normalizeToolArguments(
	args: Record<string, unknown>,
	parameters: Record<string, unknown>,
): Record<string, unknown> {
	const required = new Set(
		Array.isArray(parameters.required) ? parameters.required : [],
	);
	return Object.fromEntries(
		Object.entries(args).filter(
			([key, value]) =>
				required.has(key) || typeof value !== "string" || value.trim() !== "",
		),
	);
}
