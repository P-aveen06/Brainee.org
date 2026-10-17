/** Dependency-free transport contract shared by the Worker and private Node service. */
export type DeliveryOperation = "delivery.search" | "delivery.context" | "delivery.passages";
export type DeliverySourceType = "project" | "task" | "document" | "decision" | "discussion" | "update" | "person";
export interface DeliverySource {
	id: string;
	type: DeliverySourceType;
	label: string;
	projectId: string;
}
export interface DeliveryResult {
	scope: "company_delivery";
	sources: DeliverySource[];
	[key: string]: unknown;
}
export interface DeliveryDocumentSource {
	id: string;
	r2Key: string;
	mimeType: string;
	checksum: string | null;
	deliveryTextChecksum: string | null;
	deliveryIndexStatus: string | null;
}
const sections = ["all", "tasks", "decisions", "documents", "updates", "people"];
const fields: Record<DeliveryOperation, string[]> = {
	"delivery.search": ["query", "concepts", "offset", "limit"],
	"delivery.context": ["projectId", "taskId", "section", "offset", "limit"],
	"delivery.passages": ["documentId", "query", "concepts", "offset", "limit"],
};
export function inputRecord(value: unknown, allowed: string[]): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid delivery input.");
	const record = value as Record<string, unknown>;
	if (Object.keys(record).some(key => !allowed.includes(key))) throw new Error("Unexpected delivery input field.");
	return record;
}
export function deliveryString(value: unknown, name: string, max = 200): string {
	if (typeof value !== "string" || !value.trim() || value.length > max)
		throw new Error(`Supply a valid ${name}.`);
	return value.trim();
}
function integer(value: unknown, fallback: number, min: number, max: number) {
	if (value === undefined) return fallback;
	if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
		throw new Error(`Delivery pagination must be between ${min} and ${max}.`);
	return value;
}
export function parseDeliveryInput(operation: DeliveryOperation, value: unknown) {
	const input = inputRecord(value, fields[operation]);
	const output: Record<string, unknown> = {
		offset: integer(input.offset, 0, 0, operation === "delivery.search" ? 500 : 10000),
		limit: integer(input.limit, operation === "delivery.search" ? 15 : operation === "delivery.context" ? 25 : 6,
			1, operation === "delivery.search" ? 50 : operation === "delivery.context" ? 100 : 20),
	};
	if (operation === "delivery.context") {
		output.projectId = deliveryString(input.projectId, "project ID or code");
		if (input.taskId !== undefined) output.taskId = deliveryString(input.taskId, "task ID");
		const section = input.section ?? "all";
		if (typeof section !== "string" || !sections.includes(section)) throw new Error("Invalid context section.");
		output.section = section;
	} else {
		output.query = operation === "delivery.search"
			? deliveryString(input.query, "search query", 2000)
			: input.query === undefined || input.query === "" ? "" : deliveryString(input.query, "passage query", 2000);
		const concepts = input.concepts ?? [];
		if (!Array.isArray(concepts) || concepts.length > 24) throw new Error("Supply at most 24 search concepts.");
		output.concepts = concepts.map(term => deliveryString(term, "search concept", 120));
		if (operation === "delivery.passages") output.documentId = deliveryString(input.documentId, "document ID");
	}
	return output;
}
export function parseDeliveryResult(value: unknown): DeliveryResult {
	if (!value || typeof value !== "object") throw new Error("Invalid delivery response.");
	const result = value as DeliveryResult;
	if (result.scope !== "company_delivery" || !Array.isArray(result.sources) || result.sources.length > 1000)
		throw new Error("Invalid delivery response scope.");
	for (const source of result.sources) {
		deliveryString(source.id, "source ID");
		deliveryString(source.projectId, "source project ID");
		deliveryString(source.label, "source citation", 500);
		if (!["project", "task", "document", "decision", "discussion", "update", "person"].includes(source.type))
			throw new Error("Invalid delivery source type.");
	}
	return result;
}
export function parseDeliveryManifest(value: unknown) {
	const input = inputRecord(value, ["offset", "limit"]);
	return { offset: integer(input.offset, 0, 0, 10000), limit: integer(input.limit, 3, 1, 5) };
}
