export type Json =
	| null
	| string
	| number
	| boolean
	| Json[]
	| { [key: string]: Json };
export function jsonValue(value: unknown): Json {
	if (value === null || typeof value === "string" || typeof value === "boolean")
		return value;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (Array.isArray(value)) return value.map(jsonValue);
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, v]) => v !== undefined)
				.map(([k, v]) => [k, jsonValue(v)]),
		);
	throw new Error("Invalid graph parameter value.");
}
export function queryParams(
	value: Record<string, unknown>,
): Record<string, Json> {
	return Object.fromEntries(
		Object.entries(value)
			.filter(([, v]) => v !== undefined)
			.map(([k, v]) => [k, jsonValue(v)]),
	);
}
