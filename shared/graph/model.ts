import definitions from "./models.json" with { type: "json" };

export interface FieldDefinition {
	type: string;
	required: boolean;
	primary?: boolean;
	enum?: string[];
	default?: string | number | boolean | null;
}
export interface ReferenceDefinition {
	fields: string[];
	target: string;
	targetFields: string[];
	onDelete?: string;
}
export interface ModelDefinition {
	exportName: string;
	table: string;
	label: string;
	fields: Record<string, FieldDefinition>;
	unique: string[][];
	references: ReferenceDefinition[];
}
export const models = definitions as unknown as ModelDefinition[];
export const byLabel = new Map(models.map((model) => [model.label, model]));
export const byTable = new Map(models.map((model) => [model.table, model]));

export interface Expression<T = unknown> {
	kind: "expression";
	op: string;
	args: unknown[];
	readonly resultType?: T;
}
export interface NodeReference {
	kind: "node";
	label: string;
	alias: string;
}
export interface NodeMetadata extends NodeReference {
	table: string;
}
export type NodeModel<Row extends object = Record<string, unknown>> = {
	[K in keyof Row]-?: Expression<Row[K]>;
} & {
	readonly $node: NodeMetadata;
	readonly $inferSelect: Row;
	readonly $inferInsert: Partial<Row>;
};
export type RowOf<Model> = Model extends { $inferSelect: infer Row }
	? Row
	: never;

export function defineNode<Row extends object>(
	label: string,
	alias = label,
): NodeModel<Row> {
	const definition = byLabel.get(label);
	if (!definition) throw new Error(`Unknown graph model: ${label}`);
	const result: Record<string, unknown> = {
		$node: { kind: "node", label, alias, table: definition.table },
	};
	for (const key of Object.keys(definition.fields)) {
		result[key] = {
			kind: "expression",
			op: "property",
			args: [label, alias, key],
		};
	}
	return result as NodeModel<Row>;
}
export function aliasedTable<Model extends NodeModel<object>>(
	model: Model,
	alias: string,
): Model {
	return defineNode(model.$node.label, alias) as Model;
}
export const alias = aliasedTable;
export const nodeRef = (model: { $node: NodeMetadata }): NodeReference => ({
	kind: "node",
	label: model.$node.label,
	alias: model.$node.alias,
});

export function wire(value: unknown): unknown {
	if (value instanceof Date) return value.getTime();
	if (Array.isArray(value)) return value.map(wire);
	if (value && typeof value === "object") {
		if ("$node" in value) return nodeRef(value as { $node: NodeMetadata });
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, v]) => v !== undefined)
				.map(([k, v]) => [k, wire(v)]),
		);
	}
	return value;
}
export function hydrate(
	model: ModelDefinition,
	value: Record<string, unknown>,
) {
	return Object.fromEntries(
		Object.entries(model.fields).map(([key, field]) => [
			key,
			value[key] == null
				? null
				: field.type === "date"
					? new Date(Number(value[key]))
					: key === "id" && field.type === "number"
						? Number(value[key])
						: value[key],
		]),
	);
}
