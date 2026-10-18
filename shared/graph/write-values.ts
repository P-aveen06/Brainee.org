import type { ModelDefinition } from "./model.ts";

export function recordValues(
	model: ModelDefinition,
	input: Record<string, unknown>,
	defaults: boolean,
) {
	const result: Record<string, unknown> = {};
	for (const key of Object.keys(input))
		if (!Object.hasOwn(model.fields, key))
			throw new Error(`Unknown ${model.label} field: ${key}`);
	for (const [key, field] of Object.entries(model.fields)) {
		let value = input[key];
		if (value === undefined && defaults && field.default !== undefined)
			value = field.default === "$now" ? Date.now() : field.default;
		if (value === undefined) {
			if (defaults && field.required)
				throw new Error(`Required graph property: ${model.label}.${key}`);
			continue;
		}
		if (value === null) {
			if (field.required)
				throw new Error(`Required graph property: ${model.label}.${key}`);
		} else if (!(typeof value === "object" && "kind" in value)) {
			const expected = field.type === "date" ? "number" : field.type;
			if (
				typeof value !== expected ||
				(typeof value === "number" && !Number.isFinite(value))
			)
				throw new Error(`Invalid graph value: ${model.label}.${key}`);
			if (field.enum && !field.enum.includes(String(value)))
				throw new Error(`Invalid ${model.label}.${key}.`);
		}
		result[key] = key === "id" && value != null ? String(value) : value;
	}
	if (defaults && !Object.hasOwn(model.fields, "id"))
		result.id = String(result.userId);
	if (model.label === "Employee" && typeof result.email === "string")
		result.emailKey = result.email.toLowerCase().trim();
	if (model.label === "WfhPolicy") {
		if (result.id !== undefined && result.id !== "1")
			throw new Error("The WFH policy has one record.");
		const allowance = result.annualAllowance;
		if (
			allowance !== undefined &&
			(typeof allowance !== "number" ||
				allowance < 0.5 ||
				allowance > 365 ||
				!Number.isInteger(allowance * 2))
		)
			throw new Error("Invalid WFH allowance.");
	}
	return result;
}
