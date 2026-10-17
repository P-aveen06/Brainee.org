export type AssistantChartView =
	| "project_health"
	| "projects_by_stage"
	| "projects_by_client"
	| "delivery_risks"
	| "team_availability";

export interface AssistantChartSpec {
	type: "bar" | "line" | "donut";
	title: string;
	scope: string;
	asOf: string;
	categories: string[];
	series: Array<{ name: string; values: number[] }>;
	note?: string;
}

export interface ScopedAssistantChart {
	chart: AssistantChartSpec;
	scopeProjectIds: string[];
	scopeUserIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAssistantChartSpec(
	value: unknown,
): value is AssistantChartSpec {
	if (!isRecord(value)) return false;
	if (
		!(
			value.type === "bar" ||
			value.type === "line" ||
			value.type === "donut"
		) ||
		typeof value.title !== "string" ||
		value.title.length > 120 ||
		typeof value.scope !== "string" ||
		value.scope.length > 200 ||
		typeof value.asOf !== "string"
	) {
		return false;
	}
	const categories = value.categories;
	if (
		!Array.isArray(categories) ||
		categories.length === 0 ||
		categories.length > 30
	) {
		return false;
	}
	if (
		!categories.every(
			(category) =>
				typeof category === "string" &&
				category.length > 0 &&
				category.length <= 80,
		)
	) {
		return false;
	}
	const series = value.series;
	if (!Array.isArray(series) || series.length === 0 || series.length > 5) {
		return false;
	}
	const isValidSeries = (item: unknown) => {
		if (
			!isRecord(item) ||
			typeof item.name !== "string" ||
			item.name.length === 0 ||
			item.name.length > 60 ||
			!Array.isArray(item.values) ||
			item.values.length !== categories.length
		) {
			return false;
		}
		return item.values.every(
			(number) =>
				typeof number === "number" &&
				Number.isFinite(number) &&
				Math.abs(number) <= 1_000_000_000,
		);
	};
	return (
		series.every(isValidSeries) &&
		(value.note === undefined ||
			(typeof value.note === "string" && value.note.length <= 240))
	);
}
